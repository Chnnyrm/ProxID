"""The composition root: every object is built here, once, and injected.

Nothing else constructs a service, a client or a guard. That is what keeps a
service free of a database driver, a router free of business logic, and a test able
to build the graph with one fake substituted.

Per the house standard the container is not a module-level singleton: ``main.py``
builds one in its lifespan and hangs it on ``app.state``, and scripts build one
themselves. One object per process, held by the process, not by the module.
"""

from __future__ import annotations

from dataclasses import dataclass

from .config import Settings
from ..services.agent_service import AgentServices
from ..services.auth_service import AuthService
from ..services.category_service import CategoryService
from ..services.brevo_client import BrevoClient
from ..services.cloudinary_client import CloudinaryClient
from ..services.concordium.audit_service import AuditService
from ..services.concordium.identity_service import IdentityAdapter, build_identity_adapter
from ..services.concordium.x402_service import (
    ConcordiumX402Adapter,
    NotConfiguredX402Adapter,
    X402Adapter,
)
from ..services.concordium.registry_service import RegistryService
from ..services.concordium.x402_service import X402Service
from ..services.google_identity_client import GoogleIdentityClient
from ..services.groq_client import GroqClient
from ..services.job_service import JobService
from ..services.message_service import MessageService
from ..services.payment_service import PaymentService
from ..services.service_service import ServiceListingService
from ..services.spending_policy import AgentSpendingPolicy
from ..services.user_service import UserService
from ..services.verification_service import VerificationService
from .database import Database
from .logging import get_logger
from .resilience import DependencyGuard, ResiliencePolicy, build_guard

logger = get_logger("container")


@dataclass(frozen=True)
class Concordium:
    """The four Concordium boundaries, as one injected group."""

    identity: IdentityAdapter
    registry: RegistryService
    x402: X402Service
    audit: AuditService

    @property
    def is_configured(self) -> bool:
        """True only when both the identity side and the payment side are live."""
        return self.identity.is_configured and self.x402.is_configured


@dataclass(frozen=True)
class Container:
    """The object graph for one process."""

    settings: Settings
    database: Database
    guards: dict[str, DependencyGuard]
    auth: AuthService
    categories: CategoryService
    users: UserService
    listings: ServiceListingService
    jobs: JobService
    messages: MessageService
    payments: PaymentService
    verification: VerificationService
    spending: AgentSpendingPolicy
    concordium: Concordium
    groq: GroqClient
    cloudinary: CloudinaryClient
    brevo: BrevoClient
    google: GoogleIdentityClient

    def agent_services(self, db, user) -> AgentServices:
        """Build the agent's per-request view of the graph.

        The tool context is per request because it holds the session and the actor,
        which are the two things that must never be shared between requests.
        """
        from ..services.agent_policy import resolve_policy
        from ..services.agent_tools import ToolContext

        return AgentServices(
            groq=self.groq,
            audit=self.concordium.audit,
            settings=self.settings,
            policy=resolve_policy(user.agent_autonomy_level),
            tool_context=ToolContext(
                db=db,
                user=user,
                jobs=self.jobs,
                listings=self.listings,
                messages=self.messages,
                payments=self.payments,
                users=self.users,
                categories=self.categories,
                verification=self.verification,
                spending=self.spending,
            ),
        )


def _policy(settings: Settings, dependency: str, timeout: float) -> ResiliencePolicy:
    """One resilience policy per dependency, from configuration."""
    return ResiliencePolicy(
        dependency=dependency,
        timeout_seconds=timeout,
        failure_threshold=settings.BREAKER_FAILURE_THRESHOLD,
        reset_timeout_seconds=settings.BREAKER_RESET_SECONDS,
        half_open_probes=settings.BREAKER_HALF_OPEN_PROBES,
        max_attempts=settings.OUTBOUND_MAX_ATTEMPTS,
        base_backoff_seconds=settings.OUTBOUND_RETRY_BASE_SECONDS,
        max_concurrency=settings.OUTBOUND_BULKHEAD_LIMIT,
    )


def build_container(settings: Settings) -> Container:
    """Build the whole object graph from configuration.

    Called once from the application lifespan, and once per script run.
    """
    guards = {
        "groq": build_guard(_policy(settings, "groq", settings.GROQ_TIMEOUT_SECONDS), "groq"),
        "google": build_guard(_policy(settings, "google", settings.GROQ_TIMEOUT_SECONDS), "google"),
        "cloudinary": build_guard(_policy(settings, "cloudinary", 30.0), "cloudinary"),
        "brevo": build_guard(_policy(settings, "brevo", 10.0), "brevo"),
        "concordium": build_guard(
            _policy(settings, "concordium", settings.CONCORDIUM_REQUEST_TIMEOUT_SECONDS),
            "concordium",
        ),
    }

    database = Database(settings)

    audit = AuditService(settings)
    identity_adapter: IdentityAdapter = build_identity_adapter(settings, guards["concordium"])
    x402_adapter: X402Adapter = (
        ConcordiumX402Adapter(settings, guards["concordium"])
        if settings.x402_configured
        else NotConfiguredX402Adapter(settings)
    )
    x402 = X402Service(settings, x402_adapter)
    spending = AgentSpendingPolicy(settings)
    concordium = Concordium(
        identity=identity_adapter,
        registry=RegistryService(settings, guards["concordium"]),
        x402=x402,
        audit=audit,
    )

    google = GoogleIdentityClient(settings, guards["google"])
    groq = GroqClient(settings, guards["groq"])

    logger.info(
        "container built",
        extra={
            "operation": "build_container",
            "environment": settings.APP_ENV,
            "concordium_configured": settings.concordium_configured,
            "x402_configured": x402.is_configured,
            "veriox_configured": identity_adapter.is_configured,
            "agent_registry_address": settings.CONCORDIUM_AGENT_REGISTRY_ADDRESS,
            "concordium_live_flag": settings.FEATURE_CONCORDIUM_LIVE,
            "x402_flag": settings.FEATURE_X402_PAYMENTS,
            "judge_demo": settings.FEATURE_JUDGE_DEMO,
            "llm_available": groq.is_available,
        },
    )

    return Container(
        settings=settings,
        database=database,
        guards=guards,
        auth=AuthService(settings, google),
        categories=CategoryService(),
        users=UserService(),
        listings=ServiceListingService(),
        jobs=JobService(audit),
        messages=MessageService(audit),
        payments=PaymentService(settings, x402, audit, spending),
        verification=VerificationService(settings, identity_adapter, audit),
        spending=spending,
        concordium=concordium,
        groq=groq,
        cloudinary=CloudinaryClient(settings, guards["cloudinary"]),
        brevo=BrevoClient(settings, guards["brevo"]),
        google=google,
    )
