"""The agent's tool registry.

Ported from Gigr's ``agent_tools.py``, keeping the shape that made it work: a table
of named tools with a JSON schema the model can read, handlers that call the real
services, and one executor that never raises because a model needs a usable result
even when a call fails.

Kept: ``search_providers``, ``get_provider_reputation``, ``post_job``, ``accept_job``,
``send_message``.

Replaced: ``fund_escrow`` and ``release_escrow`` are gone. The rail is x402 on
Concordium, so the tools are ``initiate_x402_payment`` and ``settle_x402_payment``,
and both report ``not_configured`` honestly until the credentials arrive.

Removed entirely: ``get_wallet``, ``prepare_escrow_payment``, the PayPal milestone
path, and every memory tool. There is no wallet in this product.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from ..core.errors import ApplicationError
from ..core.logging import get_logger
from ..crud import agent_log as agent_log_crud
from ..models.user import User
from ..schemas.job import JobCreate
from ..schemas.service import ServiceCreate
from .job_service import JobService
from .message_service import MessageService
from .payment_service import PaymentService
from .service_service import ServiceListingService
from .user_service import UserService

logger = get_logger("agent.tools")

#: How much of a description goes into a tool result. Results are replayed into the
#: model's context, so they are trimmed on purpose.
DESCRIPTION_CHAR_LIMIT = 180
MAX_RESULTS = 5


@dataclass(frozen=True)
class ToolContext:
    """Everything a tool handler needs, injected rather than reached for."""

    db: AsyncSession
    user: User
    jobs: JobService
    listings: ServiceListingService
    messages: MessageService
    payments: PaymentService
    users: UserService


def _trim(text: str | None, limit: int = DESCRIPTION_CHAR_LIMIT) -> str:
    """One line, bounded, for a tool result."""
    cleaned = (text or "").strip().replace("\n", " ")
    return cleaned[:limit] + ("..." if len(cleaned) > limit else "")


def _error(message: str) -> dict[str, Any]:
    """A failure the model can read and act on."""
    return {"ok": False, "error": message}


def _service_card(listing) -> dict[str, Any]:
    """A listing as the model sees it: ids, price, distance, and a short description."""
    return {
        "id": str(listing.id),
        "title": listing.title,
        "price": listing.price,
        "currency": listing.currency,
        "distance_km": listing.distance_km,
        "provider_id": str(listing.provider_id),
        "provider_display_name": listing.provider_display_name,
        "provider_verified_human": listing.provider_concordium_verified,
        "description": _trim(listing.description),
    }


def _job_card(job) -> dict[str, Any]:
    """A job as the model sees it."""
    return {
        "id": str(job.id),
        "title": job.title,
        "price": job.price,
        "currency": job.currency,
        "status": job.status,
        "distance_km": job.distance_km,
        "description": _trim(job.description),
    }


# -- Handlers ----------------------------------------------------------------


async def _tool_search_providers(context: ToolContext, args: dict[str, Any]) -> dict[str, Any]:
    """Find providers a client could hire, near the client when a position is known."""
    query = str(args.get("query") or "").strip()
    latitude = args.get("latitude")
    longitude = args.get("longitude")
    radius_km = float(args.get("radius_km") or 10.0)
    verified_only = bool(args.get("verified_only") or False)

    if latitude is not None and longitude is not None:
        results = await context.listings.list_nearby(
            context.db,
            latitude=float(latitude),
            longitude=float(longitude),
            radius_km=radius_km,
            category_id=None,
            verified_only=verified_only,
            limit=MAX_RESULTS,
            offset=0,
        )
    elif query:
        results = await context.listings.search(context.db, query, limit=MAX_RESULTS, offset=0)
    else:
        return _error(
            "Provide a query, or the client's latitude and longitude, so I know what to look for."
        )

    cards = [_service_card(listing) for listing in results[:MAX_RESULTS]]
    return {
        "ok": True,
        "count": len(cards),
        "results": cards,
        "note": (
            "Use post_job to hire one of these providers, or accept_job when a provider replies."
            if cards
            else "No matching providers found. Try a wider radius or a different word."
        ),
    }


async def _tool_get_provider_reputation(
    context: ToolContext, args: dict[str, Any]
) -> dict[str, Any]:
    """A provider's trust record: the human proof, finished jobs, and their listings."""
    raw = args.get("provider_id")
    if not raw:
        return _error("provider_id is required, from search_providers.")
    try:
        provider_id = uuid.UUID(str(raw))
    except (TypeError, ValueError):
        return _error("provider_id is not a valid id.")

    try:
        provider = await context.users.get_or_raise(context.db, provider_id)
    except ApplicationError:
        return _error("That provider no longer exists.")

    cards = await context.users.build_provider_cards(context.db, [(provider, 0.0)])
    card = cards[0]
    return {
        "ok": True,
        "provider": {
            "id": str(card.id),
            "display_name": card.display_name,
            "verified_human": card.concordium_verified,
            "is_demo": card.is_demo,
            "completed_jobs": card.completed_jobs,
            "average_rating": card.average_rating,
            "rating_count": card.rating_count,
            "services": [
                {"id": str(service.id), "title": service.title, "price": service.price}
                for service in card.services
            ],
        },
        "summary": (
            f"{card.display_name}: "
            + ("human-verified, " if card.concordium_verified else "not yet human-verified, ")
            + f"{card.completed_jobs} job(s) completed."
            + (" This is demo data." if card.is_demo else "")
        ),
    }


async def _tool_post_job(context: ToolContext, args: dict[str, Any]) -> dict[str, Any]:
    """Post a job on the user's behalf. Only when they clearly asked to hire someone."""
    title = str(args.get("title") or "").strip()
    description = str(args.get("description") or "").strip()
    price = args.get("price")
    if not title or not description:
        return _error("A job needs a title and a description.")
    if price is None or float(price) <= 0:
        return _error("A job needs a budget above zero.")

    payload = JobCreate(
        title=title,
        description=description,
        price=float(price),
        latitude=args.get("latitude"),
        longitude=args.get("longitude"),
    )
    job = await context.jobs.post_job(context.db, context.user, payload)
    return {
        "ok": True,
        "job": _job_card(job),
        "note": "Posted. Providers nearby can now see it.",
    }


async def _tool_create_service_listing(
    context: ToolContext, args: dict[str, Any]
) -> dict[str, Any]:
    """Provider side: publish a new service listing on the marketplace."""
    title = str(args.get("title") or "").strip()
    description = str(args.get("description") or "").strip()
    price = args.get("price")
    if not title:
        return _error("A service listing needs a title.")
    if price is None or float(price) <= 0:
        return _error("A service listing needs a price above zero.")

    raw_category = args.get("category_id")
    category_id = None
    if raw_category:
        try:
            category_id = uuid.UUID(str(raw_category))
        except (TypeError, ValueError):
            pass

    if context.user.role not in ("provider", "both"):
        context.user.role = "both"
        await context.db.flush()

    lat = float(args["latitude"]) if args.get("latitude") is not None else context.user.latitude
    lon = float(args["longitude"]) if args.get("longitude") is not None else context.user.longitude

    payload = ServiceCreate(
        title=title,
        description=description or None,
        price=float(price),
        category_id=category_id,
        latitude=lat,
        longitude=lon,
        radius_km=float(args["radius_km"]) if args.get("radius_km") is not None else None,
    )
    listing = await context.listings.create_listing(context.db, context.user, payload)
    return {
        "ok": True,
        "service": _service_card(listing),
        "note": "Service listing published. Clients within range can now find and book it.",
    }


async def _tool_accept_job(context: ToolContext, args: dict[str, Any]) -> dict[str, Any]:
    """Provider side: accept a job that was requested from them."""
    raw = args.get("job_id")
    if not raw:
        return _error("job_id is required.")
    try:
        job_id = uuid.UUID(str(raw))
    except (TypeError, ValueError):
        return _error("job_id is not a valid id.")

    try:
        job = await context.jobs.get_job(context.db, job_id)
    except ApplicationError:
        return _error("That job no longer exists.")
    if job.status != "requested":
        return _error(
            f'"{job.title}" is {job.status}, not requested, so there is nothing to accept.'
        )

    accepted = await context.jobs.change_status(
        context.db, context.user, job_id, to_status="assigned"
    )
    return {
        "ok": True,
        "job": _job_card(accepted),
        "note": "Accepted. The client is notified and can now pay.",
    }


async def _tool_send_message(context: ToolContext, args: dict[str, Any]) -> dict[str, Any]:
    """Post into a job room the user belongs to."""
    raw = args.get("job_id")
    body = str(args.get("body") or "").strip()
    if not raw:
        return _error("job_id is required.")
    if not body:
        return _error("A message needs some text.")
    try:
        job_id = uuid.UUID(str(raw))
    except (TypeError, ValueError):
        return _error("job_id is not a valid id.")

    message = await context.messages.post_message(context.db, context.user, job_id, body)
    return {
        "ok": True,
        "message_id": str(message.id),
        "sent": True,
        "note": "Message posted to the job room.",
    }


async def _tool_initiate_x402_payment(
    context: ToolContext, args: dict[str, Any]
) -> dict[str, Any]:
    """Ask to start an x402 payment. Reports not_configured rather than pretending.

    The agent cannot move money. This creates a payment record the human then acts
    on; while the rail is unconfigured, it creates a record that says exactly that.
    """
    raw = args.get("job_id")
    if not raw:
        return _error("job_id is required.")
    try:
        job_id = uuid.UUID(str(raw))
    except (TypeError, ValueError):
        return _error("job_id is not a valid id.")

    key = str(args.get("idempotency_key") or f"agent-{context.user.id}-{job_id}")
    view = await context.payments.initiate(
        context.db, context.user, job_id=job_id, idempotency_key=key
    )
    return {
        "ok": True,
        "configured": view.configured,
        "status": view.status,
        "message": view.message,
        "receipt_id": str(view.receipt.id) if view.receipt else None,
        "tx_hash": view.receipt.x402_tx_hash if view.receipt else None,
        "note": (
            "No money moved. Say this plainly: the payment rail is not connected yet."
            if view.status == "not_configured"
            else "The human still has to approve the payment."
        ),
    }


async def _tool_settle_x402_payment(
    context: ToolContext, args: dict[str, Any]
) -> dict[str, Any]:
    """Settle a payment record. Reports not_configured rather than pretending."""
    raw = args.get("receipt_id")
    if not raw:
        return _error("receipt_id is required.")
    try:
        receipt_id = uuid.UUID(str(raw))
    except (TypeError, ValueError):
        return _error("receipt_id is not a valid id.")

    key = str(args.get("idempotency_key") or f"agent-settle-{receipt_id}")
    view = await context.payments.settle(
        context.db, context.user, receipt_id=receipt_id, idempotency_key=key
    )
    return {
        "ok": True,
        "configured": view.configured,
        "status": view.status,
        "message": view.message,
        "tx_hash": view.receipt.x402_tx_hash if view.receipt else None,
    }


async def _tool_my_jobs(context: ToolContext, args: dict[str, Any]) -> dict[str, Any]:
    """The user's own jobs, as a compact list."""
    jobs = await context.jobs.list_mine(context.db, context.user, limit=10, offset=0)
    return {
        "ok": True,
        "count": len(jobs),
        "jobs": [_job_card(job) for job in jobs[:MAX_RESULTS]],
        "note": "Use a job id to accept it, message about it, or pay for it.",
    }


# -- Registry ----------------------------------------------------------------

_TOOL_TABLE: dict[str, dict[str, Any]] = {
    "search_providers": {
        "description": (
            "Find providers the user could hire, nearest first. Prefer passing the "
            "user's latitude and longitude so results are ranked by distance."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "What the user needs, for example 'plumber'."},
                "latitude": {"type": "number", "description": "The user's latitude, if known."},
                "longitude": {"type": "number", "description": "The user's longitude, if known."},
                "radius_km": {"type": "number", "description": "Search radius in kilometres. Default 10."},
                "verified_only": {
                    "type": "boolean",
                    "description": "Only providers with a Concordium human proof.",
                },
            },
            "required": [],
        },
        "handler": _tool_search_providers,
        "read_only": True,
    },
    "get_provider_reputation": {
        "description": (
            "Look up a provider's trust record before hiring: whether their human proof "
            "is on file, how many jobs they finished, and their listings."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "provider_id": {"type": "string", "description": "Provider id from search_providers."},
            },
            "required": ["provider_id"],
        },
        "handler": _tool_get_provider_reputation,
        "read_only": True,
    },
    "post_job": {
        "description": "Post a job on the user's behalf. Only when they clearly asked to hire someone.",
        "parameters": {
            "type": "object",
            "properties": {
                "title": {"type": "string"},
                "description": {"type": "string"},
                "price": {"type": "number", "description": "Budget in the job currency (NGN)."},
                "latitude": {"type": "number"},
                "longitude": {"type": "number"},
            },
            "required": ["title", "description", "price"],
        },
        "handler": _tool_post_job,
        "read_only": False,
    },
    "create_service_listing": {
        "description": "Provider side: publish a new service listing that clients within range can search for and book.",
        "parameters": {
            "type": "object",
            "properties": {
                "title": {"type": "string", "description": "Title of the trade or service offered."},
                "description": {"type": "string", "description": "Details of what is included."},
                "price": {"type": "number", "description": "Standard price for the service in NGN."},
                "category_id": {"type": "string", "description": "Optional category uuid."},
                "latitude": {"type": "number"},
                "longitude": {"type": "number"},
                "radius_km": {"type": "number", "description": "Service coverage radius in km."},
            },
            "required": ["title", "price"],
        },
        "handler": _tool_create_service_listing,
        "read_only": False,
    },
    "accept_job": {
        "description": (
            "Provider side: accept a job that was requested from the user. Only the job's "
            "provider can accept it."
        ),
        "parameters": {
            "type": "object",
            "properties": {"job_id": {"type": "string", "description": "Job id to accept."}},
            "required": ["job_id"],
        },
        "handler": _tool_accept_job,
        "read_only": False,
    },
    "send_message": {
        "description": (
            "Post a message into a job room the user belongs to. Use it to confirm scope, "
            "send an update, or nudge the other side."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "job_id": {"type": "string", "description": "Job id whose room to post into."},
                "body": {"type": "string", "description": "Message text."},
            },
            "required": ["job_id", "body"],
        },
        "handler": _tool_send_message,
        "read_only": False,
    },
    "initiate_x402_payment": {
        "description": (
            "Start an x402 payment for a job the user posted. The agent never moves money: "
            "this creates a payment record the human acts on. The rail is not connected in "
            "this build, so it reports not_configured. Never claim a payment happened."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "job_id": {"type": "string", "description": "The job to pay for."},
                "idempotency_key": {
                    "type": "string",
                    "description": "Optional stable key so a retry does not create a second payment.",
                },
            },
            "required": ["job_id"],
        },
        "handler": _tool_initiate_x402_payment,
        "read_only": False,
    },
    "settle_x402_payment": {
        "description": (
            "Settle a payment record the user owns. The rail is not connected in this build, "
            "so it reports not_configured and no hash exists."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "receipt_id": {"type": "string", "description": "Payment record id."},
                "idempotency_key": {"type": "string"},
            },
            "required": ["receipt_id"],
        },
        "handler": _tool_settle_x402_payment,
        "read_only": False,
    },
    "my_jobs": {
        "description": "List the user's own jobs: the ones they posted and the ones they are working on.",
        "parameters": {"type": "object", "properties": {}, "required": []},
        "handler": _tool_my_jobs,
        "read_only": True,
    },
}


def tool_specs() -> list[dict[str, Any]]:
    """The tool definitions in the OpenAI/Groq function-calling format."""
    return [
        {
            "type": "function",
            "function": {
                "name": name,
                "description": spec["description"],
                "parameters": spec["parameters"],
            },
        }
        for name, spec in _TOOL_TABLE.items()
    ]


def tool_names() -> list[str]:
    """Every tool name, in registration order."""
    return list(_TOOL_TABLE.keys())


def summarise_step(name: str, result: dict[str, Any]) -> str:
    """One short line for the activity feed. Never the whole result."""
    if not result.get("ok", True):
        return f"{name} could not run: {result.get('error')}"
    if name == "search_providers":
        return f"found {result.get('count', 0)} provider(s)"
    if name == "get_provider_reputation":
        provider = result.get("provider") or {}
        return f"checked {provider.get('display_name') or 'a provider'}"
    if name == "post_job":
        job = result.get("job") or {}
        return f"posted \"{job.get('title')}\""
    if name == "create_service_listing":
        service = result.get("service") or {}
        return f"published \"{service.get('title')}\""
    if name == "accept_job":
        job = result.get("job") or {}
        return f"accepted \"{job.get('title')}\""
    if name == "send_message":
        return "sent a message to the job room"
    if name == "initiate_x402_payment":
        return f"payment {result.get('status')}"
    if name == "settle_x402_payment":
        return f"settlement {result.get('status')}"
    if name == "my_jobs":
        return f"reviewed {result.get('count', 0)} job(s)"
    return name


async def execute_tool(
    context: ToolContext,
    name: str,
    arguments: dict[str, Any],
    *,
    job_id: uuid.UUID | None = None,
) -> dict[str, Any]:
    """Run one tool by name, never raising.

    An unknown tool, a handler failure and a domain error all come back as a result
    the model can read. Every call writes an ``agent_tool_logs`` row, so what the
    agent did is reviewable afterwards.
    """
    spec = _TOOL_TABLE.get(name)
    if spec is None:
        return _error(f"unknown tool '{name}'")

    try:
        result = await spec["handler"](context, arguments or {})
    except ApplicationError as error:
        result = _error(error.external_message)
        logger.info(
            "agent tool refused",
            extra={"operation": "execute_tool", "tool": name, **error.to_log_context()},
        )
    except Exception as error:  # noqa: BLE001 - the model needs a usable result
        result = _error(f"{name} failed. Nothing was changed.")
        logger.warning(
            "agent tool failed",
            extra={"operation": "execute_tool", "tool": name, "error": type(error).__name__},
        )

    await agent_log_crud.create(
        context.db,
        user_id=context.user.id,
        tool_name=name,
        arguments=arguments or {},
        succeeded=bool(result.get("ok", False)),
        summary=summarise_step(name, result),
        job_id=job_id,
        is_demo=context.user.is_demo,
    )
    return result
