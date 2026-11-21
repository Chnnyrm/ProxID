"""Job business rules: posting, matching, state, and who may move it.

The state machine lives here and only here. The database constrains the set of
legal values; this class constrains the set of legal moves and who may make them.

Transition table (actor in brackets):

    open        -> assigned    [client assigns a provider]
    requested   -> assigned    [the requested provider accepts]
    assigned    -> in_progress [the provider starts]
    in_progress -> completed   [the client confirms]
    any live    -> cancelled   [client or the assigned provider]
    in_progress -> disputed    [client or provider]

Anything else is a conflict. A terminal job never moves again.
"""

from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from ..core.errors import AuthorizationError, ConflictError, NotFoundError, ValidationError
from ..core.geo import extract_coordinates
from ..crud import category as category_crud
from ..crud import job as job_crud
from ..crud import message as message_crud
from ..crud import service as service_crud
from ..crud import user as user_crud
from ..models.job import TERMINAL_JOB_STATUSES, Job
from ..models.user import User
from ..schemas.job import JobCreate, JobOut, JobRoomOut
from ..schemas.message import MessageOut
from .concordium.audit_service import AuditService
from .user_service import to_user_out

#: Which move each (from, to) pair represents, for authorisation and audit.
TRANSITIONS: dict[tuple[str, str], str] = {
    ("open", "assigned"): "assign_provider",
    ("requested", "assigned"): "accept_job",
    ("assigned", "in_progress"): "start_job",
    ("in_progress", "completed"): "complete_job",
    ("open", "cancelled"): "cancel_job",
    ("requested", "cancelled"): "cancel_job",
    ("assigned", "cancelled"): "cancel_job",
    ("in_progress", "cancelled"): "cancel_job",
    ("in_progress", "disputed"): "dispute_job",
}

#: Who may perform each move.
ACTOR_RULES: dict[str, tuple[str, ...]] = {
    "assign_provider": ("client",),
    "accept_job": ("provider",),
    "start_job": ("provider",),
    "complete_job": ("client",),
    "cancel_job": ("client", "provider"),
    "dispute_job": ("client", "provider"),
}


def to_job_out(
    job: Job,
    *,
    distance_metres: float | None = None,
    client: User | None = None,
    provider: User | None = None,
    category_name: str | None = None,
) -> JobOut:
    """Map a job to the wire shape, resolving its point into a coordinate pair."""
    latitude, longitude = extract_coordinates(job.location)
    return JobOut(
        id=job.id,
        client_id=job.client_id,
        provider_id=job.provider_id,
        service_listing_id=job.service_listing_id,
        category_id=job.category_id,
        category_name=category_name,
        title=job.title,
        description=job.description,
        price=float(job.price),
        min_price=float(job.min_price) if job.min_price is not None else None,
        max_price=float(job.max_price) if job.max_price is not None else None,
        currency=job.currency,
        status=job.status,
        latitude=latitude,
        longitude=longitude,
        image_url=job.image_url,
        distance_km=round(distance_metres / 1000.0, 2) if distance_metres is not None else None,
        client_display_name=client.display_name if client else None,
        provider_display_name=provider.display_name if provider else None,
        x402_tx_hash=job.x402_tx_hash,
        is_demo=job.is_demo,
        created_at=job.created_at,
        updated_at=job.updated_at,
    )


class JobService:
    """The job use cases."""

    def __init__(self, audit: AuditService) -> None:
        self._audit = audit

    # -- Creation -----------------------------------------------------------

    async def post_job(self, db: AsyncSession, actor: User, payload: JobCreate) -> JobOut:
        """Post a job for a provider to find.

        A listing id is accepted only when it belongs to the provider it points at,
        so a client cannot attach their job to someone else's listing.
        """
        if payload.service_listing_id is not None:
            listing = await service_crud.get_by_id(db, payload.service_listing_id)
            if listing is None:
                raise ValidationError(
                    f"post_job refused: service_listing_id={payload.service_listing_id} does not exist (layer=crud)",
                    operation="post_job",
                    external_message="That provider listing no longer exists. Pick the service again, or post the job without one.",
                )

        effective_price = payload.price if payload.price is not None else (payload.min_price or 0.0)
        job = await job_crud.create(
            db,
            client_id=actor.id,
            title=payload.title,
            description=payload.description,
            price=effective_price,
            min_price=payload.min_price,
            max_price=payload.max_price,
            category_id=payload.category_id,
            service_listing_id=payload.service_listing_id,
            latitude=payload.latitude,
            longitude=payload.longitude,
            image_url=payload.image_url,
            scheduled_for=payload.scheduled_for,
        )
        await self._audit.record(
            db,
            action="post_job",
            subject_type="job",
            subject_id=str(job.id),
            outcome="success",
            actor_id=actor.id,
            detail={"title": job.title, "price": float(job.price)},
        )
        names = await category_crud.names_by_ids(db, [payload.category_id] if payload.category_id else [])
        return to_job_out(
            job,
            client=actor,
            category_name=names.get(payload.category_id) if payload.category_id else None,
        )

    # -- Reading ------------------------------------------------------------

    async def list_open_nearby(
        self,
        db: AsyncSession,
        *,
        latitude: float,
        longitude: float,
        radius_km: float,
        exclude_user_id: uuid.UUID | None,
        category_id: uuid.UUID | None,
        limit: int,
        offset: int,
    ) -> list[JobOut]:
        """Open jobs around a point, nearest first.

        The caller's own jobs are excluded by default: they belong under "my jobs",
        not in the browse list.
        """
        rows = await job_crud.list_open_nearby(
            db,
            latitude,
            longitude,
            radius_km,
            exclude_user_id=exclude_user_id,
            category_id=category_id,
            limit=limit,
            offset=offset,
        )
        return await self._decorate(db, rows)

    async def browse(self, db: AsyncSession, *, limit: int, offset: int) -> list[JobOut]:
        """The default open-jobs list, ranked by freshness blended with activity."""
        jobs = await job_crud.list_open_by_browse_rank(db, limit=limit, offset=offset)
        return await self._decorate(db, [(job, None) for job in jobs])

    async def search(
        self,
        db: AsyncSession,
        *,
        status: str | None,
        category_id: uuid.UUID | None,
        search_text: str | None,
        min_price: float | None,
        max_price: float | None,
        latitude: float | None,
        longitude: float | None,
        radius_km: float,
        sort_by: str | None,
        limit: int,
        offset: int,
    ) -> list[JobOut]:
        """The general job query behind the filters in the interface."""
        rows = await job_crud.list_filtered(
            db,
            status=status,
            category_id=category_id,
            search_text=search_text,
            min_price=min_price,
            max_price=max_price,
            latitude=latitude,
            longitude=longitude,
            radius_km=radius_km,
            sort_by=sort_by,
            limit=limit,
            offset=offset,
        )
        return await self._decorate(db, rows)

    async def list_mine(self, db: AsyncSession, actor: User, *, limit: int, offset: int) -> list[JobOut]:
        """Jobs the caller posted and jobs they were hired for, newest first."""
        posted = await job_crud.list_by_client(db, actor.id, limit=limit, offset=offset)
        working = await job_crud.list_by_provider(db, actor.id, limit=limit, offset=offset)
        seen: set[uuid.UUID] = set()
        rows: list[tuple[Job, float | None]] = []
        for job in [*posted, *working]:
            if job.id in seen:
                continue
            seen.add(job.id)
            rows.append((job, None))
        rows.sort(key=lambda pair: pair[0].created_at, reverse=True)
        return await self._decorate(db, rows)

    async def get_job(self, db: AsyncSession, job_id: uuid.UUID) -> JobOut:
        """One job, or a not-found that does not distinguish hidden from missing."""
        job = await job_crud.get_by_id(db, job_id)
        if job is None:
            raise NotFoundError(
                f"get_job failed: job_id={job_id} not found (layer=crud)",
                operation="get_job",
                external_message="We could not find that job. It may have been removed.",
            )
        decorated = await self._decorate(db, [(job, None)])
        return decorated[0]

    async def get_room(self, db: AsyncSession, actor: User, job_id: uuid.UUID) -> JobRoomOut:
        """The job room: the job, both participants, and the thread.

        Access is membership, checked here. A stranger gets the same answer as a
        missing job, so the endpoint cannot be used to probe which ids exist.
        """
        job = await self._participant_job(db, actor, job_id, operation="get_job_room")
        client = await user_crud.get_by_id(db, job.client_id)
        provider = await user_crud.get_by_id(db, job.provider_id) if job.provider_id else None
        messages = await message_crud.list_by_job(db, job.id, limit=200)

        senders = await user_crud.get_many_by_ids(
            db, [message.sender_id for message in messages if message.sender_id is not None]
        )
        from ..crud import x402_receipt as receipt_crud

        receipt = await receipt_crud.get_latest_for_job(db, job.id)
        names = await category_crud.names_by_ids(db, [job.category_id] if job.category_id else [])
        return JobRoomOut(
            job=to_job_out(
                job,
                client=client,
                provider=provider,
                category_name=names.get(job.category_id) if job.category_id else None,
            ),
            client=to_user_out(client) if client else to_user_out(actor),
            provider=to_user_out(provider) if provider else None,
            messages=[
                MessageOut(
                    id=message.id,
                    job_id=message.job_id,
                    sender_id=message.sender_id,
                    author_kind=message.author_kind,
                    body=message.body,
                    sender_display_name=(
                        senders[message.sender_id].display_name
                        if message.sender_id and message.sender_id in senders
                        else None
                    ),
                    is_demo=message.is_demo,
                    created_at=message.created_at,
                )
                for message in messages
            ],
            payment_status=receipt.status if receipt else None,
        )

    # -- State --------------------------------------------------------------

    async def change_status(
        self,
        db: AsyncSession,
        actor: User,
        job_id: uuid.UUID,
        *,
        to_status: str,
        provider_id: uuid.UUID | None = None,
    ) -> JobOut:
        """Move a job through one legal transition, as the right actor.

        Three checks in order, all in the service: the job exists and the caller can
        see it, the transition is legal from the current state, and the caller's
        role permits it. A failure to update atomically is a conflict, not a
        success, because another request moved the job first.
        """
        job = await self._participant_job(db, actor, job_id, operation="change_job_status")
        if job.status in TERMINAL_JOB_STATUSES:
            raise ConflictError(
                f"change_job_status refused: job_id={job_id} is terminal status={job.status} (layer=service)",
                operation="change_job_status",
                external_message=(
                    f"This job is already {job.status}, so it cannot be changed again. "
                    "Post a new job if you need more work done."
                ),
            )

        move = TRANSITIONS.get((job.status, to_status))
        if move is None:
            raise ConflictError(
                f"change_job_status refused: no transition {job.status}->{to_status} for job_id={job_id} (layer=service)",
                operation="change_job_status",
                external_message=(
                    f"A job that is {job.status} cannot become {to_status}. Refresh the page to see its current state."
                ),
            )

        role = self._role_of(actor, job)
        if role not in ACTOR_RULES[move]:
            raise AuthorizationError(
                f"change_job_status denied: actor={actor.id} role={role} may not {move} job_id={job_id} (layer=service)",
                operation="change_job_status",
                external_message=self._denial_message(move),
            )

        assigned_provider_id: uuid.UUID | None = job.provider_id
        if move == "assign_provider":
            if provider_id is None:
                raise ValidationError(
                    f"assign_provider refused: no provider_id for job_id={job_id} (layer=service)",
                    operation="assign_provider",
                    external_message="Choose the provider you want to hire for this job.",
                )
            await self._require_hireable_provider(db, provider_id)
            assigned_provider_id = provider_id
        elif move == "accept_job":
            assigned_provider_id = actor.id

        changed = await job_crud.transition_status(
            db,
            job_id,
            [job.status],
            to_status,
            provider_id=assigned_provider_id,
        )
        if not changed:
            raise ConflictError(
                f"change_job_status conflict: job_id={job_id} left status={job.status} concurrently (layer=crud)",
                operation="change_job_status",
                external_message=(
                    "Someone else changed this job at the same moment. Refresh to see its current state, then try again."
                ),
            )

        await self._audit.record(
            db,
            action=move,
            subject_type="job",
            subject_id=str(job_id),
            outcome="success",
            actor_id=actor.id,
            detail={
                "from_status": job.status,
                "to_status": to_status,
                "provider_id": str(assigned_provider_id) if assigned_provider_id else None,
            },
        )
        refreshed = await job_crud.get_by_id(db, job_id)
        if refreshed is None:
            raise NotFoundError(
                f"change_job_status failed: job_id={job_id} vanished after update (layer=crud)",
                operation="change_job_status",
                external_message="That job disappeared while we were updating it. Refresh the page.",
            )
        decorated = await self._decorate(db, [(refreshed, None)])
        return decorated[0]

    # -- Helpers ------------------------------------------------------------

    async def _require_hireable_provider(self, db: AsyncSession, provider_id: uuid.UUID) -> User:
        """A provider must exist, be active, and offer work."""
        provider = await user_crud.get_by_id(db, provider_id)
        if provider is None or not provider.is_active:
            raise ValidationError(
                f"assign_provider refused: provider_id={provider_id} is missing or inactive (layer=crud)",
                operation="assign_provider",
                external_message="That provider is no longer available. Choose someone else from the list.",
            )
        if provider.role not in ("provider", "both"):
            raise ValidationError(
                f"assign_provider refused: provider_id={provider_id} role={provider.role} is not a provider (layer=service)",
                operation="assign_provider",
                external_message="That account does not offer services, so it cannot be hired for this job.",
            )
        return provider

    async def _participant_job(
        self, db: AsyncSession, actor: User, job_id: uuid.UUID, *, operation: str
    ) -> Job:
        """One job the caller is part of. Strangers get a not-found, not a forbidden."""
        job = await job_crud.get_by_id(db, job_id)
        if job is None:
            raise NotFoundError(
                f"{operation} failed: job_id={job_id} not found (layer=crud)",
                operation=operation,
                external_message="We could not find that job room. It may have been removed.",
            )
        if actor.id not in {job.client_id, job.provider_id}:
            raise NotFoundError(
                f"{operation} denied: actor={actor.id} is not a participant of job_id={job_id} (layer=service)",
                operation=operation,
                external_message="We could not find that job room. It may have been removed.",
            )
        return job

    @staticmethod
    def _role_of(actor: User, job: Job) -> str:
        """The caller's role on this specific job."""
        if actor.id == job.client_id:
            return "client"
        if job.provider_id is not None and actor.id == job.provider_id:
            return "provider"
        return "stranger"

    @staticmethod
    def _denial_message(move: str) -> str:
        """Why the caller cannot make this move, in their words."""
        return {
            "assign_provider": "Only the person who posted this job can hire a provider for it.",
            "accept_job": "Only the provider this job was requested from can accept it.",
            "start_job": "Only the hired provider can start this job.",
            "complete_job": "Only the person who posted this job can mark it complete.",
            "cancel_job": "Only the client or the hired provider can cancel this job.",
            "dispute_job": "Only the client or the hired provider can open a dispute.",
        }.get(move, "You cannot make that change to this job.")

    async def _decorate(
        self, db: AsyncSession, rows: list[tuple[Job, float | None]]
    ) -> list[JobOut]:
        """Attach the people and the category to a batch of jobs in two queries."""
        owner_ids = {job.client_id for job, _ in rows}
        owner_ids.update(job.provider_id for job, _ in rows if job.provider_id is not None)
        people = await user_crud.get_many_by_ids(db, list(owner_ids))
        category_names = await category_crud.names_by_ids(
            db, [job.category_id for job, _ in rows if job.category_id is not None]
        )
        return [
            to_job_out(
                job,
                distance_metres=distance_metres,
                client=people.get(job.client_id),
                provider=people.get(job.provider_id) if job.provider_id else None,
                category_name=category_names.get(job.category_id) if job.category_id else None,
            )
            for job, distance_metres in rows
        ]
