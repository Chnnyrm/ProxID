"""Seed the Judge Demo.

Run with::

    cd backend && python -m app.scripts.seed_demo

Safe to run twice: every row has a deterministic id derived from its key, so a second
run updates rather than duplicates, and the report counts what it actually changed.

The demo is built around the four beats the workshops say judges look for:

1. **A company-backed agent and a consumer-backed agent.** One provider is a company
   with its own agent account; the demo person has an agent too. Their two agents are in
   one job room, and the room shows the exchange.
2. **Identity and age by zero-knowledge proof.** The providers are marked human-verified
   with a proof reference, and the demo person has an approved age-over-18 verification
   request.
3. **Human consent through the ID app.** A verification request row holds the QR step and
   the domain binding, so the consent moment is a thing on the screen rather than a claim
   in the copy.
4. **Receipts and payments anchored on chain.** Receipts exist with status ``demo``, and
   the audit trail carries a real nonce and a real payload hash per entry, which is
   exactly what would be anchored.

**Nothing here is chain data.** No address is a real address, no hash is a settlement
hash, and every row is marked ``is_demo`` in the row itself. The strings that stand in
for chain values start with ``demo-``, which cannot be parsed as a base58 account
address, so a demo record can never be mistaken for a real one by a reader or a script.
"""

from __future__ import annotations

import asyncio
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from ..core.config import settings
from ..core.database import Database
from ..core.security import hash_password
from ..models.agent_log import AgentToolLog
from ..models.audit_event import AuditEvent
from ..models.category import Category
from ..models.job import Job
from ..models.message import JobMessage
from ..models.service import ServiceListing
from ..models.user import User
from ..models.verification_request import VerificationRequest
from ..models.x402_receipt import X402Receipt
from ..services.concordium.audit_service import payload_hash, safe_detail

#: Namespace for deterministic ids. Changing it would duplicate a seeded database, so it
#: is a constant with a comment rather than a value derived at runtime.
DEMO_NAMESPACE = uuid.UUID("6f1f4a52-0f6a-4a0e-9d3e-6c1f0b7a2d11")

#: The demo person's email, imported from the auth service so there is exactly one
#: definition of it. ``AuthService.demo_login`` looks it up by name.
from ..services.auth_service import DEMO_USER_EMAIL  # noqa: E402  (constant, not a cycle)

#: Every demo password. Not a secret: the account is a demonstration and is marked so.
DEMO_PASSWORD = "demo-only-not-a-real-account"

#: One neighbourhood, so distances on the map are all a few hundred metres.
NEIGHBOURHOOD = "Yaba, Lagos"
NEIGHBOURHOOD_CENTRE = (6.5095, 3.3711)


def demo_id(key: str) -> uuid.UUID:
    """A stable id for a demo row. The same key always yields the same UUID."""
    return uuid.uuid5(DEMO_NAMESPACE, key)


@dataclass(frozen=True)
class ProviderSpec:
    """One seeded provider, and the proof it is carrying."""

    key: str
    display_name: str
    email: str
    bio: str
    latitude: float
    longitude: float
    neighbourhood: str
    verified: bool
    proof_reference: str | None
    #: The agent account for a company-backed provider. ``demo-`` prefixed on purpose.
    agent_account: str | None
    company: str | None
    listings: tuple[tuple[str, str, str, float], ...] = ()


@dataclass(frozen=True)
class JobSpec:
    """One seeded job, in one state, with its room."""

    key: str
    title: str
    description: str
    price: float
    status: str
    provider_key: str | None
    category_slug: str
    latitude: float
    longitude: float
    messages: tuple[tuple[str, str], ...] = ()
    receipt: str | None = None


@dataclass
class SeedReport:
    """What a seed run changed. Printed, and asserted by a test."""

    created: dict[str, int] = field(default_factory=dict)
    updated: dict[str, int] = field(default_factory=dict)

    def count(self, table: str, *, created: bool) -> None:
        bucket = self.created if created else self.updated
        bucket[table] = bucket.get(table, 0) + 1

    def summary(self) -> str:
        created = sum(self.created.values())
        updated = sum(self.updated.values())
        parts = [f"created {created}", f"updated {updated}"]
        for table in sorted({*self.created, *self.updated}):
            parts.append(f"{table}={self.created.get(table, 0)}+{self.updated.get(table, 0)}")
        return ", ".join(parts)


CATEGORIES: tuple[tuple[str, str, str], ...] = (
    ("Plumbing", "plumbing", "Leaks, pipes, taps and drains"),
    ("Electrical", "electrical", "Wiring, sockets, fittings and generators"),
    ("Cleaning", "cleaning", "Homes, offices and post-construction"),
    ("Pest Control", "pest-control", "Fumigation and infestation treatment"),
    ("Appliance Repair", "appliance-repair", "Fridges, washing machines and cookers"),
)

PROVIDERS: tuple[ProviderSpec, ...] = (
    ProviderSpec(
        key="northgate",
        display_name="Northgate Facilities Ltd",
        email="provider.northgate@proxid.local",
        bio=(
            "A facilities company with two vans in Yaba. Our booking agent handles "
            "scheduling and quotes, and a human signs off every job."
        ),
        latitude=6.5121,
        longitude=3.3739,
        neighbourhood="Yaba, Lagos",
        verified=True,
        proof_reference="demo-proof-ref-northgate-0001",
        # A company-backed agent: its own account, separate from the human's.
        agent_account="demo-agent-account-northgate",
        company="Northgate Facilities Ltd",
        listings=(
            ("Emergency plumbing call-out", "Burst pipes, blocked drains and leaks, same day.", "plumbing", 12000.0),
            ("Office deep clean", "Weekend deep clean for up to 200 square metres.", "cleaning", 45000.0),
        ),
    ),
    ProviderSpec(
        key="amaka",
        display_name="Amaka Obi",
        email="provider.amaka@proxid.local",
        bio="Independent electrician, 9 years in Lagos. Sockets, wiring and inverter installs.",
        latitude=6.5068,
        longitude=3.3688,
        neighbourhood="Yaba, Lagos",
        verified=True,
        proof_reference="demo-proof-ref-amaka-0002",
        agent_account=None,
        company=None,
        listings=(
            ("Socket and wiring repair", "Diagnose and fix faulty sockets, switches and wiring.", "electrical", 8000.0),
        ),
    ),
    ProviderSpec(
        key="tunde",
        display_name="Tunde Balogun",
        email="provider.tunde@proxid.local",
        bio="Fumigation and pest control. Pet-safe treatment, certificates on request.",
        latitude=6.5155,
        longitude=3.3652,
        neighbourhood="Yaba, Lagos",
        verified=True,
        proof_reference="demo-proof-ref-tunde-0003",
        agent_account=None,
        company=None,
        listings=(("Fumigation, two-bedroom flat", "Cockroaches, bedbugs and rodents. Pet-safe.", "pest-control", 15000.0),),
    ),
    ProviderSpec(
        key="ifeoma",
        display_name="Ifeoma Nwosu",
        email="provider.ifeoma@proxid.local",
        bio="Appliance repair: fridges, washing machines, microwaves. Home visits.",
        latitude=6.5031,
        longitude=3.3755,
        neighbourhood="Yaba, Lagos",
        verified=False,
        proof_reference=None,
        agent_account=None,
        company=None,
        listings=(("Washing machine repair", "Drum, pump and control board faults.", "appliance-repair", 9500.0),),
    ),
)

JOBS: tuple[JobSpec, ...] = (
    JobSpec(
        key="active-plumbing",
        title="Fix the kitchen sink leak",
        description=(
            "Water is pooling under the kitchen sink and the cabinet is swelling. "
            "The trap looks cracked. I am home after 5pm on weekdays."
        ),
        price=12000.0,
        status="in_progress",
        provider_key="northgate",
        category_slug="plumbing",
        latitude=6.5102,
        longitude=3.3701,
        messages=(
            ("client", "The leak is worse this morning. Are you still able to come today?"),
            ("provider", "Yes. Our agent has scheduled a van for 5:30pm. A plumber will bring a replacement trap."),
            ("agent", "Booked for 5:30pm today. The quote is 12,000 NGN, which matches your budget. You will approve the payment in your wallet."),
            ("provider", "On site now. Trap replaced and the cabinet is drying. I will send photos when the seal cures."),
        ),
        receipt="demo",
    ),
    JobSpec(
        key="open-electrical",
        title="Two sockets in the front room stopped working",
        description=(
            "Both sockets on the left wall stopped working after a power surge. No "
            "breaker has tripped. I need someone who can test the circuit."
        ),
        price=8000.0,
        status="open",
        provider_key=None,
        category_slug="electrical",
        latitude=6.5088,
        longitude=3.3722,
        messages=(),
    ),
    JobSpec(
        key="open-fumigation",
        title="Fumigate a two-bedroom flat before moving in",
        description=(
            "Empty flat, keys available from the agent. There is a cockroach problem and "
            "I would like a pet-safe treatment because I am bringing a cat."
        ),
        price=15000.0,
        status="open",
        provider_key=None,
        category_slug="pest-control",
        latitude=6.5170,
        longitude=3.3640,
        messages=(),
    ),
    JobSpec(
        key="completed-cleaning",
        title="Deep clean after painting",
        description="Paint dust everywhere, two bedrooms and a living room. Completed last week.",
        price=45000.0,
        status="completed",
        provider_key="northgate",
        category_slug="cleaning",
        latitude=6.5135,
        longitude=3.3699,
        messages=(
            ("client", "The flat looks great, thank you. Releasing the payment now."),
            ("provider", "Thank you. The same team can come monthly if you want to schedule it."),
        ),
        receipt="demo",
    ),
)


def _demo_audit_hash(action: str, subject_id: str, nonce: str) -> str:
    """The payload hash a seeded audit row carries.

    Real hashing, over a payload with no personal data: the same function the service
    uses, which is what makes the demo's audit trail a true example of the pattern.
    """
    payload = {
        "action": action,
        "subject_type": "job",
        "subject_id": subject_id,
        "outcome": "success",
        "detail": safe_detail({"status": "demo"}),
    }
    return payload_hash(nonce, payload)


async def _upsert(session: AsyncSession, model, row_id: uuid.UUID, values: dict) -> tuple[object, bool]:
    """Insert or update one row by its deterministic id. Returns ``(row, created)``."""
    existing = await session.get(model, row_id)
    if existing is None:
        row = model(id=row_id, **values)
        session.add(row)
        await session.flush()
        return row, True
    for name, value in values.items():
        setattr(existing, name, value)
    await session.flush()
    return existing, False


async def seed(session: AsyncSession) -> SeedReport:
    """Write the demo data. Idempotent: a second run updates, it does not duplicate."""
    report = SeedReport()
    now = datetime.now(timezone.utc)

    # -- Categories ---------------------------------------------------------
    category_ids: dict[str, uuid.UUID] = {}
    for name, slug, description in CATEGORIES:
        row_id = demo_id(f"category:{slug}")
        category_ids[slug] = row_id
        _row, created = await _upsert(
            session,
            Category,
            row_id,
            {"name": name, "slug": slug, "description": description},
        )
        report.count("categories", created=created)

    # -- The demo person ----------------------------------------------------
    demo_user_id = demo_id("user:judge-demo")
    demo_user, created = await _upsert(
        session,
        User,
        demo_user_id,
        {
            "email": DEMO_USER_EMAIL,
            "display_name": "Ada (judge demo)",
            "hashed_password": hash_password(DEMO_PASSWORD),
            "role": "both",
            "bio": "Judge demo profile. Everything here is seeded data, not a real account.",
            "latitude": NEIGHBOURHOOD_CENTRE[0],
            "longitude": NEIGHBOURHOOD_CENTRE[1],
            "neighbourhood": NEIGHBOURHOOD,
            "is_demo": True,
            "is_active": True,
            "agent_autonomy_level": "medium",
            # The consumer-backed agent: its own account, distinct from the human's.
            "agent_account_address": "demo-agent-account-ada",
            "agent_verified": True,
            "agent_verification_ref": "demo-agent-credential-ada",
            "agent_card_url": "demo://agent-card/ada",
            "concordium_account_address": "demo-human-account-ada",
            "concordium_verified": True,
            "concordium_zk_proof_ref": "demo-proof-ref-ada-0009",
            "verified_at": now - timedelta(days=3),
        },
    )
    report.count("users", created=created)
    from ..core.geo import to_wkt_point

    demo_user.last_location = to_wkt_point(*NEIGHBOURHOOD_CENTRE)
    await session.flush()

    # -- Providers ----------------------------------------------------------
    provider_ids: dict[str, uuid.UUID] = {}
    for spec in PROVIDERS:
        row_id = demo_id(f"user:{spec.key}")
        provider_ids[spec.key] = row_id
        row, created = await _upsert(
            session,
            User,
            row_id,
            {
                "email": spec.email,
                "display_name": spec.display_name,
                "role": "provider",
                "bio": spec.bio,
                "latitude": spec.latitude,
                "longitude": spec.longitude,
                "neighbourhood": spec.neighbourhood,
                "is_demo": True,
                "is_active": True,
                "concordium_account_address": f"demo-human-account-{spec.key}",
                "concordium_verified": spec.verified,
                "concordium_zk_proof_ref": spec.proof_reference,
                "verified_at": now - timedelta(days=10) if spec.verified else None,
                "agent_account_address": spec.agent_account,
                "agent_verified": bool(spec.agent_account),
                "agent_verification_ref": (
                    f"demo-agent-credential-{spec.key}" if spec.agent_account else None
                ),
                "agent_card_url": (
                    f"demo://agent-card/{spec.key}" if spec.agent_account else None
                ),
                "agent_autonomy_level": "low" if spec.agent_account else "off",
            },
        )
        report.count("users", created=created)
        row.last_location = to_wkt_point(spec.latitude, spec.longitude)
        await session.flush()

        # A company account is marked in the bio as well as the name: a judge reading
        # the row should not have to infer that from the suffix.
        if spec.company:
            row.bio = f"{spec.company}. {spec.bio}"

        for index, (title, description, slug, price) in enumerate(spec.listings):
            listing_id = demo_id(f"listing:{spec.key}:{index}")
            _listing, listing_created = await _upsert(
                session,
                ServiceListing,
                listing_id,
                {
                    "provider_id": row_id,
                    "category_id": category_ids[slug],
                    "title": title,
                    "description": description,
                    "price": Decimal(str(price)),
                    "min_price": None,
                    "max_price": None,
                    "currency": "NGN",
                    "radius_km": Decimal("5"),
                    "is_active": True,
                    "is_demo": True,
                    "location": to_wkt_point(spec.latitude, spec.longitude),
                },
            )
            report.count("service_listings", created=listing_created)

    # -- Jobs, rooms, receipts ---------------------------------------------
    for spec in JOBS:
        job_id = demo_id(f"job:{spec.key}")
        provider_id = provider_ids.get(spec.provider_key) if spec.provider_key else None
        job, created = await _upsert(
            session,
            Job,
            job_id,
            {
                "client_id": demo_user_id,
                "provider_id": provider_id,
                "service_listing_id": None,
                "category_id": category_ids[spec.category_slug],
                "title": spec.title,
                "description": spec.description,
                "price": Decimal(str(spec.price)),
                "currency": "NGN",
                "status": spec.status,
                "location": to_wkt_point(spec.latitude, spec.longitude),
                "message_count": len(spec.messages),
                "completed_at": now - timedelta(days=7) if spec.status == "completed" else None,
                # No hash: a demo receipt never writes one.
                "x402_tx_hash": None,
                "is_demo": True,
            },
        )
        report.count("jobs", created=created)

        for index, (author_kind, body) in enumerate(spec.messages):
            message_id = demo_id(f"message:{spec.key}:{index}")
            sender_id = (
                demo_user_id
                if author_kind == "client"
                else provider_id
                if author_kind == "provider"
                else None
            )
            _message, message_created = await _upsert(
                session,
                JobMessage,
                message_id,
                {
                    "job_id": job_id,
                    "sender_id": sender_id,
                    "author_kind": author_kind,
                    "body": body,
                    "is_demo": True,
                },
            )
            report.count("job_messages", created=message_created)

        if spec.receipt:
            receipt_id = demo_id(f"receipt:{spec.key}")
            _receipt, receipt_created = await _upsert(
                session,
                X402Receipt,
                receipt_id,
                {
                    "job_id": job_id,
                    "payer_id": demo_user_id,
                    "payee_id": provider_id,
                    "amount": Decimal(str(spec.price)),
                    "currency": "NGN",
                    "status": "demo",
                    "network": "concordium",
                    "network_caip2": settings.CONCORDIUM_CAIP2_NETWORK,
                    "asset": settings.X402_ASSET,
                    "fee_payer": None,
                    "requirements": {
                        "demo": True,
                        "note": "Placeholder receipt. No payment was made and nothing is on chain.",
                    },
                    "x402_tx_hash": None,
                    "idempotency_key": f"demo-{spec.key}",
                    "is_demo": True,
                },
            )
            report.count("x402_receipts", created=receipt_created)

    # -- Agent tool log -----------------------------------------------------
    log_entries = (
        ("search_providers", "found 4 provider(s)", {"query": "plumber", "radius_km": 5}),
        ("get_provider_reputation", "checked Northgate Facilities Ltd", {"provider_id": "demo"}),
        ("post_job", 'posted "Fix the kitchen sink leak"', {"title": "Fix the kitchen sink leak", "price": 12000}),
        ("send_message", "sent a message to the job room", {"job_id": "demo"}),
        ("initiate_x402_payment", "payment not_configured", {"job_id": "demo"}),
    )
    for index, (tool_name, summary, arguments) in enumerate(log_entries):
        entry_id = demo_id(f"agent-log:{index}")
        _entry, entry_created = await _upsert(
            session,
            AgentToolLog,
            entry_id,
            {
                "user_id": demo_user_id,
                "job_id": demo_id("job:active-plumbing"),
                "tool_name": tool_name,
                "arguments": arguments,
                "succeeded": True,
                "summary": summary,
                "is_demo": True,
            },
        )
        report.count("agent_tool_logs", created=entry_created)

    # -- Verification: the consent beat ------------------------------------
    verification_id = demo_id("verification:age-over-18")
    request_nonce = "demo-nonce-age-over-18-0001"
    _verification, verification_created = await _upsert(
        session,
        VerificationRequest,
        verification_id,
        {
            "user_id": demo_user_id,
            "purpose": "age_over_18",
            "bound_domain": settings.VERIOX_BOUND_DOMAIN,
            "status": "demo_approved",
            "nonce": request_nonce,
            "expires_at": now + timedelta(minutes=5),
            "consumed_at": now - timedelta(minutes=1),
            "qr_payload": "demo://concordium-id-app/verification/demo-nonce-age-over-18-0001",
            "request_anchor_ref": "demo-anchor-request-age-over-18",
            "audit_anchor_ref": "demo-anchor-audit-age-over-18",
            "zk_proof_ref": "demo-proof-ref-age-over-18",
            "outcome_detail": {
                "demo": True,
                "note": "Demonstrates the consent flow. No proof was verified and no anchor was written.",
            },
            "is_demo": True,
        },
    )
    report.count("verification_requests", created=verification_created)

    # -- Audit trail: real hashes, no personal data -------------------------
    audit_specs = (
        ("demo_login", "user", str(demo_user_id)),
        ("post_job", "job", str(demo_id("job:active-plumbing"))),
        ("accept_job", "job", str(demo_id("job:active-plumbing"))),
        ("initiate_x402_payment", "job", str(demo_id("job:active-plumbing"))),
        ("approve_verification", "user", str(demo_user_id)),
    )
    for index, (action, subject_type, subject_id) in enumerate(audit_specs):
        audit_id = demo_id(f"audit:{index}")
        nonce = f"demo-nonce-audit-{index:04d}"
        _audit, audit_created = await _upsert(
            session,
            AuditEvent,
            audit_id,
            {
                "actor_id": demo_user_id,
                "action": action,
                "subject_type": subject_type,
                "subject_id": subject_id,
                "outcome": "success",
                "detail": safe_detail({"status": "demo", "configured": False}),
                "correlation_id": f"demo-correlation-{index}",
                "client_ip": None,
                "record_nonce": nonce,
                "payload_hash": _demo_audit_hash(action, subject_id, nonce),
                "anchor_tx_hash": None,
                "anchored_at": None,
            },
        )
        report.count("audit_events", created=audit_created)

    return report


async def main() -> None:
    """Open a database session, seed, commit, report."""
    database = Database(settings)
    async with database.session() as session:
        report = await seed(session)
    await database.dispose()
    print(f"[OK] demo seeded: {report.summary()}")
    print(f"[OK] sign in with {DEMO_USER_EMAIL} or press Launch Judge Demo")


if __name__ == "__main__":
    asyncio.run(main())
