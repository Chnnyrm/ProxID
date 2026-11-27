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
from ..schemas.service import ServiceCreate, ServiceUpdate
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
    categories: Any = None
    verification: Any = None


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

NEIGHBOURHOOD_COORDINATES: dict[str, tuple[float, float]] = {
    "yaba": (6.5121, 3.3739),
    "surulere": (6.4975, 3.3592),
    "ikeja": (6.5954, 3.3364),
    "lekki": (6.4698, 3.5852),
    "victoria island": (6.4281, 3.4219),
    "vi": (6.4281, 3.4219),
    "ikoyi": (6.4549, 3.4356),
    "lagos island": (6.4549, 3.4046),
    "maryland": (6.5744, 3.3664),
    "gbagada": (6.5562, 3.3884),
}


def resolve_coordinates(context: ToolContext, args: dict[str, Any]) -> tuple[float | None, float | None]:
    """Resolve coordinates following the strict priority order:
    1. User's stored position first (context.user.latitude, context.user.longitude)
    2. Explicit request args (args.get('latitude'), args.get('longitude'))
    3. User's saved neighbourhood (context.user.neighbourhood)
    """
    if context.user.latitude is not None and context.user.longitude is not None:
        return float(context.user.latitude), float(context.user.longitude)

    arg_lat = args.get("latitude")
    arg_lon = args.get("longitude")
    if arg_lat is not None and arg_lon is not None:
        try:
            return float(arg_lat), float(arg_lon)
        except (ValueError, TypeError):
            pass

    if context.user.neighbourhood:
        n_lower = context.user.neighbourhood.lower().strip()
        for name, coords in NEIGHBOURHOOD_COORDINATES.items():
            if name in n_lower:
                return coords
        return None, None

    return None, None


async def _tool_search_providers(context: ToolContext, args: dict[str, Any]) -> dict[str, Any]:
    """Find providers a client could hire, prioritizing user's stored position."""
    query = str(args.get("query") or "").strip()
    radius_km = float(args.get("radius_km") or 10.0)
    verified_only = bool(args.get("verified_only") or False)

    lat, lon = resolve_coordinates(context, args)

    if lat is not None and lon is not None:
        results = await context.listings.list_nearby(
            context.db,
            latitude=lat,
            longitude=lon,
            radius_km=radius_km,
            category_id=None,
            verified_only=verified_only,
            limit=MAX_RESULTS,
            offset=0,
        )
        if query:
            q_lower = query.lower()
            filtered = [
                item for item in results
                if q_lower in item.title.lower()
                or (item.description and q_lower in item.description.lower())
                or (item.category_name and q_lower in item.category_name.lower())
            ]
            if filtered:
                results = filtered
            elif not results:
                results = await context.listings.search(context.db, query, limit=MAX_RESULTS, offset=0)
    elif query:
        results = await context.listings.search(context.db, query, limit=MAX_RESULTS, offset=0)
    else:
        return _error(
            "I have no saved location for your account. Which neighbourhood or area are you in?"
        )

    cards = [_service_card(listing) for listing in results[:MAX_RESULTS]]
    return {
        "ok": True,
        "count": len(cards),
        "results": cards,
        "coordinates_used": {"latitude": lat, "longitude": lon} if lat is not None else None,
        "note": (
            "Use post_job to hire one of these providers, or accept_job when a provider replies."
            if cards
            else "No matching providers found. Try a wider radius or a different word."
        ),
    }


async def _tool_set_my_location(context: ToolContext, args: dict[str, Any]) -> dict[str, Any]:
    """Store or update the user's location coordinates and neighbourhood."""
    lat = args.get("latitude")
    lon = args.get("longitude")
    neighbourhood = args.get("neighbourhood")

    if lat is not None and lon is not None:
        context.user.latitude = float(lat)
        context.user.longitude = float(lon)
    if neighbourhood:
        context.user.neighbourhood = str(neighbourhood).strip()
        if context.user.latitude is None or context.user.longitude is None:
            n_lower = context.user.neighbourhood.lower()
            for name, coords in NEIGHBOURHOOD_COORDINATES.items():
                if name in n_lower:
                    context.user.latitude, context.user.longitude = coords
                    break

    await context.db.flush()
    return {
        "ok": True,
        "message": f"Saved your location as {context.user.neighbourhood or 'active coordinates'}.",
        "latitude": context.user.latitude,
        "longitude": context.user.longitude,
        "neighbourhood": context.user.neighbourhood,
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

    lat, lon = resolve_coordinates(context, args)

    images = args.get("image_urls") or args.get("images") or []
    image_url = images[0] if images else args.get("image_url")

    payload = JobCreate(
        title=title,
        description=description,
        price=float(price),
        latitude=lat,
        longitude=lon,
        image_url=image_url,
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

    images = args.get("image_urls") or args.get("images") or []
    image_url = images[0] if images else args.get("image_url")

    payload = ServiceCreate(
        title=title,
        description=description or None,
        price=float(price),
        category_id=category_id,
        latitude=lat,
        longitude=lon,
        radius_km=float(args["radius_km"]) if args.get("radius_km") is not None else None,
        image_url=image_url,
    )
    listing = await context.listings.create_listing(context.db, context.user, payload)
    return {
        "ok": True,
        "service": _service_card(listing),
        "note": "Service listing published. Clients within range can now find and book it.",
    }


async def _tool_update_service_listing(
    context: ToolContext, args: dict[str, Any]
) -> dict[str, Any]:
    """Provider side: update an existing service listing."""
    raw_id = args.get("service_id")
    if not raw_id:
        return _error("service_id is required.")
    try:
        service_id = uuid.UUID(str(raw_id))
    except (TypeError, ValueError):
        return _error("service_id is not a valid UUID.")

    raw_category = args.get("category_id")
    category_id = None
    if raw_category:
        try:
            category_id = uuid.UUID(str(raw_category))
        except (TypeError, ValueError):
            pass

    images = args.get("image_urls") or args.get("images") or []
    image_url = images[0] if images else args.get("image_url")

    payload = ServiceUpdate(
        title=args.get("title"),
        description=args.get("description"),
        price=float(args["price"]) if args.get("price") is not None else None,
        category_id=category_id,
        image_url=image_url,
        is_active=args.get("is_active"),
    )
    try:
        listing = await context.listings.update_listing(
            context.db, context.user, service_id, payload
        )
    except ApplicationError as exc:
        return _error(exc.external_message)
    except Exception as exc:
        return _error(f"Failed to update listing: {exc}")

    return {
        "ok": True,
        "service": _service_card(listing),
        "note": f"Service listing '{listing.title}' updated successfully.",
    }


async def _tool_create_category(
    context: ToolContext, args: dict[str, Any]
) -> dict[str, Any]:
    """Create a new marketplace service category."""
    name = str(args.get("name") or "").strip()
    if not name:
        return _error("Category name cannot be empty or whitespace only.")

    try:
        if context.categories and hasattr(context.categories, "create_category"):
            category = await context.categories.create_category(context.db, name, user_id=context.user.id)
            return {
                "ok": True,
                "category": {"id": str(category.id), "name": category.name, "slug": category.slug},
                "note": f"Category '{category.name}' created and available immediately.",
            }
        else:
            import re
            from ..crud import category as category_crud
            from ..models.category import Category

            slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
            existing = await category_crud.get_by_name(context.db, name)
            if existing:
                return {
                    "ok": True,
                    "category": {"id": str(existing.id), "name": existing.name, "slug": existing.slug},
                    "note": f"Category '{existing.name}' already exists and is ready to use.",
                }

            cat = Category(name=name, slug=slug)
            context.db.add(cat)
            await context.db.commit()
            await context.db.refresh(cat)
            return {
                "ok": True,
                "category": {"id": str(cat.id), "name": cat.name, "slug": cat.slug},
                "note": f"Category '{cat.name}' created and available immediately.",
            }
    except Exception as exc:
        return _error(f"Failed to create category: {exc}")


async def _tool_hire_provider(
    context: ToolContext, args: dict[str, Any]
) -> dict[str, Any]:
    """Hire a provider for a job, assigning them and locking the agreement."""
    raw_provider_id = args.get("provider_id")
    if not raw_provider_id:
        return _error("provider_id is required to hire a provider.")
    try:
        provider_id = uuid.UUID(str(raw_provider_id))
    except (TypeError, ValueError):
        return _error("provider_id is not a valid UUID.")

    raw_job_id = args.get("job_id")
    job_id = None
    if raw_job_id:
        try:
            job_id = uuid.UUID(str(raw_job_id))
        except (TypeError, ValueError):
            return _error("job_id is not a valid UUID.")

    if not job_id:
        title = str(args.get("title") or "Direct Hire Service").strip()
        price = args.get("price")
        if price is None or float(price) <= 0:
            price = 10000.0
        lat, lon = resolve_coordinates(context, args)
        payload = JobCreate(
            title=title,
            description=args.get("description") or f"Direct hire request for provider {provider_id}",
            price=float(price),
            latitude=lat,
            longitude=lon,
        )
        created_job = await context.jobs.post_job(context.db, context.user, payload)
        job_id = created_job.id

    try:
        job = await context.jobs.change_status(
            context.db,
            context.user,
            job_id,
            to_status="assigned",
            provider_id=provider_id,
        )
        return {
            "ok": True,
            "job": _job_card(job),
            "note": f"Provider successfully hired for job '{job.title}'. Room is now assigned.",
        }
    except ApplicationError as exc:
        return {"ok": False, "status": "not_configured", "error": exc.external_message}
    except Exception as exc:
        return {"ok": False, "status": "not_configured", "error": f"Could not hire provider: {exc}"}


async def _tool_request_identity_verification(
    context: ToolContext, args: dict[str, Any]
) -> dict[str, Any]:
    """Initiate a single-use Concordium Zero-Knowledge verification challenge."""
    purpose = str(args.get("purpose") or "personhood").strip()
    if purpose not in ("personhood", "age_over_18"):
        purpose = "personhood"

    if not context.verification:
        return {
            "ok": False,
            "status": "not_configured",
            "error": "Concordium verification service is not initialized on this deployment.",
        }

    try:
        req = await context.verification.request_verification(
            context.db,
            context.user,
            purpose=purpose,
        )
        return {
            "ok": True,
            "status": "pending",
            "nonce": req.nonce,
            "purpose": req.purpose,
            "bound_domain": req.bound_domain,
            "qr_payload": req.qr_payload,
            "note": f"Verification challenge created (nonce: {req.nonce[:8]}...). Open Concordium ID App or /profile to approve.",
        }
    except ApplicationError as exc:
        return {"ok": False, "status": "not_configured", "error": exc.external_message}
    except Exception as exc:
        return {"ok": False, "status": "not_configured", "error": f"Verification challenge failed: {exc}"}


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


async def _tool_apply_job(context: ToolContext, args: dict[str, Any]) -> dict[str, Any]:
    """Provider side: apply for an open job."""
    raw = args.get("job_id")
    if not raw:
        return _error("job_id is required.")
    try:
        job_id = uuid.UUID(str(raw))
    except (TypeError, ValueError):
        return _error("job_id is not a valid id.")

    message = args.get("message")
    proposed_price = args.get("proposed_price")

    try:
        app = await context.jobs.apply_to_job(
            context.db,
            context.user,
            job_id,
            message=message,
            proposed_price=proposed_price,
        )
    except ApplicationError as exc:
        return _error(exc.external_message)
    except Exception as exc:
        return _error(f"Failed to apply: {exc}")

    return {
        "ok": True,
        "application_id": str(app.id),
        "job_id": str(app.job_id),
        "status": app.status,
        "note": "Application submitted successfully! The client has received your proposal.",
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
                "image_urls": {"type": "array", "items": {"type": "string"}, "description": "Listing image URLs."},
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
                "image_urls": {"type": "array", "items": {"type": "string"}, "description": "Listing image URLs."},
            },
            "required": ["title", "price"],
        },
        "handler": _tool_create_service_listing,
        "read_only": False,
    },
    "update_service_listing": {
        "description": "Provider side: update an existing service listing (title, description, price, category, images).",
        "parameters": {
            "type": "object",
            "properties": {
                "service_id": {"type": "string", "description": "UUID of the listing to update."},
                "title": {"type": "string", "description": "New title."},
                "description": {"type": "string", "description": "New description."},
                "price": {"type": "number", "description": "New price in NGN."},
                "category_id": {"type": "string", "description": "New category UUID."},
                "image_urls": {"type": "array", "items": {"type": "string"}, "description": "Updated image URLs."},
                "is_active": {"type": "boolean", "description": "Whether the listing is active."},
            },
            "required": ["service_id"],
        },
        "handler": _tool_update_service_listing,
        "read_only": False,
    },
    "create_category": {
        "description": "Create a new marketplace service category when none matches the user's needs.",
        "parameters": {
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "Name of the new category to create."},
            },
            "required": ["name"],
        },
        "handler": _tool_create_category,
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
    "apply_job": {
        "description": "Provider side: apply for an open job with an optional proposal message.",
        "parameters": {
            "type": "object",
            "properties": {
                "job_id": {"type": "string", "description": "Job UUID to apply for."},
                "message": {"type": "string", "description": "Proposal or introductory message."},
                "proposed_price": {"type": "number", "description": "Optional proposed price in NGN."},
            },
            "required": ["job_id"],
        },
        "handler": _tool_apply_job,
        "read_only": False,
    },
    "apply_to_job": {
        "description": "Provider side: apply for an open job with an optional proposal message.",
        "parameters": {
            "type": "object",
            "properties": {
                "job_id": {"type": "string", "description": "Job UUID to apply for."},
                "message": {"type": "string", "description": "Proposal or introductory message."},
                "proposed_price": {"type": "number", "description": "Optional proposed price in NGN."},
            },
            "required": ["job_id"],
        },
        "handler": _tool_apply_job,
        "read_only": False,
    },
    "hire_provider": {
        "description": "Hire a provider for a job, assigning them and locking the agreement.",
        "parameters": {
            "type": "object",
            "properties": {
                "provider_id": {"type": "string", "description": "Provider user UUID."},
                "job_id": {"type": "string", "description": "Optional job UUID to assign the provider to."},
                "title": {"type": "string", "description": "Job title if creating a new direct hire job."},
                "price": {"type": "number", "description": "Agreed price in NGN."},
                "description": {"type": "string", "description": "Scope of work."},
            },
            "required": ["provider_id"],
        },
        "handler": _tool_hire_provider,
        "read_only": False,
    },
    "request_identity_verification": {
        "description": "Initiate a Concordium Zero-Knowledge verification challenge for personhood or age proof.",
        "parameters": {
            "type": "object",
            "properties": {
                "purpose": {
                    "type": "string",
                    "enum": ["personhood", "age_over_18"],
                    "description": "Verification purpose.",
                },
            },
            "required": [],
        },
        "handler": _tool_request_identity_verification,
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
    "set_my_location": {
        "description": "Save or update the user's location coordinates or neighbourhood name.",
        "parameters": {
            "type": "object",
            "properties": {
                "latitude": {"type": "number", "description": "GPS latitude coordinate."},
                "longitude": {"type": "number", "description": "GPS longitude coordinate."},
                "neighbourhood": {"type": "string", "description": "Area or neighbourhood name."},
            },
            "required": [],
        },
        "handler": _tool_set_my_location,
        "read_only": False,
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
    if name == "apply_job" or name == "apply_to_job":
        return f"applied to job {result.get('job_id', '')[:8]}"
    if name == "update_service_listing":
        return "updated service listing"
    if name == "create_category":
        cat = result.get("category") or {}
        return f"created category '{cat.get('name', '')}'"
    if name == "hire_provider":
        job = result.get("job") or {}
        return f"hired provider for \"{job.get('title', 'job')}\""
    if name == "request_identity_verification":
        return f"initiated {result.get('purpose', 'personhood')} verification"
    if name == "set_my_location":
        return f"saved location: {result.get('neighbourhood') or 'coordinates'}"
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
