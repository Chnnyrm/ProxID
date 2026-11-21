"""Persistence for jobs, including the nearby search.

Ported from Gigr's ``crud/job.py`` with the PostGIS semantics unchanged:

- ``ST_DWithin(job.location, point, radius_km * 1000)`` on the geography column,
  radius in metres.
- ``ST_Distance(job.location, point)`` for the metres between a point and a job.

Three behaviours were deliberately changed because the ported version did work in
Python that belongs in the query:

- The "hotness" browse ranking is now one SQL expression instead of fetching every
  job, scoring it and slicing the list, which broke pagination.
- Text relevance is summed in SQL for the same reason.
- Status transitions use a single conditional ``UPDATE ... WHERE status IN (...)``
  and report whether a row changed, so two concurrent requests cannot both win.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import case, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.geo import geography_point, to_wkt_point
from ..core.text_search import tokenize_query
from ..models.job import Job

#: A job is "half as fresh" after this many hours, for the browse ranking.
HOTNESS_FRESHNESS_HALFLIFE_HOURS = 72
#: Demand is capped so a single early applicant cannot dominate the ranking.
HOTNESS_DEMAND_CAP = 5
HOTNESS_FRESHNESS_WEIGHT = 0.6
HOTNESS_DEMAND_WEIGHT = 0.4


async def get_by_id(db: AsyncSession, job_id: uuid.UUID) -> Job | None:
    """One job by id, or None."""
    result = await db.execute(select(Job).where(Job.id == job_id))
    return result.scalar_one_or_none()


async def list_by_client(
    db: AsyncSession, client_id: uuid.UUID, *, limit: int = 20, offset: int = 0
) -> list[Job]:
    """Jobs one person posted, newest first."""
    result = await db.execute(
        select(Job)
        .where(Job.client_id == client_id)
        .order_by(Job.created_at.desc(), Job.id.asc())
        .limit(limit)
        .offset(offset)
    )
    return list(result.scalars().all())


async def list_by_provider(
    db: AsyncSession, provider_id: uuid.UUID, *, limit: int = 20, offset: int = 0
) -> list[Job]:
    """Jobs one provider was hired for, newest first."""
    result = await db.execute(
        select(Job)
        .where(Job.provider_id == provider_id)
        .order_by(Job.created_at.desc(), Job.id.asc())
        .limit(limit)
        .offset(offset)
    )
    return list(result.scalars().all())


async def list_open_nearby(
    db: AsyncSession,
    latitude: float,
    longitude: float,
    radius_km: float,
    *,
    exclude_user_id: uuid.UUID | None = None,
    category_id: uuid.UUID | None = None,
    limit: int = 20,
    offset: int = 0,
) -> list[tuple[Job, float]]:
    """Open jobs within ``radius_km`` of a point, nearest first.

    Returns ``(job, distance_metres)``. ``radius_km <= 0`` means no radius limit,
    the same convention as the listing search.
    """
    point = geography_point(longitude, latitude)
    distance = func.ST_Distance(Job.location, point).label("distance_m")

    conditions = [Job.status == "open", Job.location.isnot(None)]
    if radius_km and radius_km > 0:
        conditions.append(func.ST_DWithin(Job.location, point, radius_km * 1000))
    if exclude_user_id is not None:
        conditions.append(Job.client_id != exclude_user_id)
    if category_id is not None:
        conditions.append(Job.category_id == category_id)

    query = (
        select(Job, distance)
        .where(*conditions)
        .order_by(distance.asc(), Job.id.asc())
        .limit(limit)
        .offset(offset)
    )
    rows = (await db.execute(query)).all()
    return [(job, float(distance_m or 0.0)) for job, distance_m in rows]


async def list_open_by_browse_rank(
    db: AsyncSession, *, limit: int = 20, offset: int = 0
) -> list[Job]:
    """The default browse list: open jobs ranked by freshness blended with activity.

    ``hotness = 0.6 * exp(-age_hours / 72) + 0.4 * min(applications, 5) / 5``

    ProxID has no application table, so the demand half of the formula counts the
    messages in the job room, which is the same signal (people are talking about
    it). The count is a column on the job, maintained by the message service, so
    this ranking stays a single-table query that the database can paginate.
    """
    age_hours = func.extract(
        "epoch", func.now() - func.coalesce(Job.created_at, func.now())
    ) / 3600.0
    freshness = func.exp(-age_hours / HOTNESS_FRESHNESS_HALFLIFE_HOURS)
    demand = func.least(Job.message_count, HOTNESS_DEMAND_CAP) / float(HOTNESS_DEMAND_CAP)
    hotness = HOTNESS_FRESHNESS_WEIGHT * freshness + HOTNESS_DEMAND_WEIGHT * demand

    query = (
        select(Job)
        .where(Job.status == "open")
        .order_by(hotness.desc(), Job.created_at.desc(), Job.id.asc())
        .limit(limit)
        .offset(offset)
    )
    return list((await db.execute(query)).scalars().all())


async def list_filtered(
    db: AsyncSession,
    *,
    client_id: uuid.UUID | None = None,
    provider_id: uuid.UUID | None = None,
    status: str | None = None,
    category_id: uuid.UUID | None = None,
    min_price: float | None = None,
    max_price: float | None = None,
    latitude: float | None = None,
    longitude: float | None = None,
    radius_km: float = 10.0,
    search_text: str | None = None,
    sort_by: str | None = None,
    limit: int = 20,
    offset: int = 0,
) -> list[tuple[Job, float | None]]:
    """The general job query: filters, optional distance, optional relevance.

    One query for every combination, with pagination at the database. Returns
    ``(job, distance_metres_or_None)``.
    """
    point = None
    distance = None
    if latitude is not None and longitude is not None:
        point = geography_point(longitude, latitude)
        distance = func.ST_Distance(Job.location, point).label("distance_m")

    conditions = []
    if client_id is not None:
        conditions.append(Job.client_id == client_id)
    if provider_id is not None:
        conditions.append(Job.provider_id == provider_id)
    if status:
        wanted = [state.strip() for state in status.split(",") if state.strip()]
        conditions.append(Job.status.in_(wanted))
    if category_id is not None:
        conditions.append(Job.category_id == category_id)
    if min_price is not None:
        conditions.append(Job.price >= min_price)
    if max_price is not None:
        conditions.append(Job.price <= max_price)
    if point is not None and radius_km and radius_km > 0:
        conditions.append(func.ST_DWithin(Job.location, point, radius_km * 1000))

    relevance = None
    if search_text:
        tokens = tokenize_query(search_text)[:8]
        if tokens:
            text_conditions = []
            relevance = None
            for token in tokens:
                pattern = f"%{token}%"
                text_conditions.extend([Job.title.ilike(pattern), Job.description.ilike(pattern)])
                contribution = case((Job.title.ilike(pattern), 1), else_=0) + case(
                    (Job.description.ilike(pattern), 1), else_=0
                )
                relevance = contribution if relevance is None else relevance + contribution
        else:
            pattern = f"%{search_text}%"
            text_conditions = [Job.title.ilike(pattern), Job.description.ilike(pattern)]
            relevance = case((Job.title.ilike(pattern), 1), else_=0)
        conditions.append(or_(*text_conditions))

    columns = [Job] if distance is None else [Job, distance]
    query = select(*columns)
    if conditions:
        query = query.where(*conditions)

    if sort_by == "price_asc":
        query = query.order_by(Job.price.asc(), Job.id.asc())
    elif sort_by == "price_desc":
        query = query.order_by(Job.price.desc(), Job.id.asc())
    elif sort_by == "newest":
        query = query.order_by(Job.created_at.desc(), Job.id.asc())
    elif sort_by == "nearest" and distance is not None:
        query = query.order_by(distance.asc(), Job.id.asc())
    elif relevance is not None:
        query = query.order_by(relevance.desc(), Job.created_at.desc(), Job.id.asc())
    else:
        query = query.order_by(Job.created_at.desc(), Job.id.asc())

    query = query.limit(limit).offset(offset)
    if distance is None:
        return [(job, None) for job in (await db.execute(query)).scalars().all()]
    rows = (await db.execute(query)).all()
    return [(job, float(distance_m or 0.0)) for job, distance_m in rows]


async def create(
    db: AsyncSession,
    *,
    client_id: uuid.UUID,
    title: str,
    description: str | None,
    price: float,
    min_price: float | None,
    max_price: float | None,
    category_id: uuid.UUID | None,
    service_listing_id: uuid.UUID | None,
    latitude: float | None,
    longitude: float | None,
    image_url: str | None = None,
    scheduled_for: datetime | None = None,
    is_demo: bool = False,
) -> Job:
    """Insert one open job and flush."""
    job = Job(
        client_id=client_id,
        title=title.strip(),
        description=description,
        price=price,
        min_price=min_price,
        max_price=max_price,
        category_id=category_id,
        service_listing_id=service_listing_id,
        status="open",
        image_url=image_url,
        scheduled_for=scheduled_for,
        is_demo=is_demo,
    )
    if latitude is not None and longitude is not None:
        job.location = to_wkt_point(latitude, longitude)
    db.add(job)
    await db.flush()
    return job


async def transition_status(
    db: AsyncSession,
    job_id: uuid.UUID,
    from_statuses: list[str],
    to_status: str,
    *,
    provider_id: uuid.UUID | None = None,
    x402_tx_hash: str | None = None,
) -> bool:
    """Atomically move a job between states.

    Returns True only when a row actually changed. A False return is a conflict:
    another request moved the job first, and the caller must report that rather
    than pretend the transition happened.
    """
    values: dict[str, object] = {"status": to_status, "updated_at": datetime.now(timezone.utc)}
    if provider_id is not None:
        values["provider_id"] = provider_id
    if x402_tx_hash is not None:
        values["x402_tx_hash"] = x402_tx_hash
    if to_status == "completed":
        values["completed_at"] = datetime.now(timezone.utc)

    result = await db.execute(
        update(Job)
        .where(Job.id == job_id, Job.status.in_(from_statuses))
        .values(**values)
    )
    await db.flush()
    return bool(result.rowcount)


async def count_completed_for_provider(db: AsyncSession, provider_id: uuid.UUID) -> int:
    """How many jobs this provider finished, counted in the query."""
    result = await db.execute(
        select(func.count(Job.id)).where(
            Job.provider_id == provider_id, Job.status == "completed"
        )
    )
    return int(result.scalar_one() or 0)


@dataclass(frozen=True)
class CompletedJobPrices:
    """The recorded price range of a set of completed jobs."""

    count: int
    minimum: Decimal | None
    maximum: Decimal | None
    average: Decimal | None


async def summarize_completed_prices(
    db: AsyncSession, category_id: uuid.UUID, exclude_job_id: uuid.UUID | None = None
) -> CompletedJobPrices:
    """Count, minimum, maximum and average price of comparable completed jobs.

    A job with no recorded price is not comparable and is excluded rather than
    counted as zero, which would drag the average down.
    """
    conditions = [
        Job.category_id == category_id,
        Job.status == "completed",
        Job.price.isnot(None),
        Job.price > 0,
    ]
    if exclude_job_id is not None:
        conditions.append(Job.id != exclude_job_id)
    result = await db.execute(
        select(func.count(Job.id), func.min(Job.price), func.max(Job.price), func.avg(Job.price)).where(
            *conditions
        )
    )
    count, minimum, maximum, average = result.one()
    return CompletedJobPrices(
        count=int(count or 0), minimum=minimum, maximum=maximum, average=average
    )
