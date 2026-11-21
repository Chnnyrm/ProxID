"""Concordium integration boundaries.

Four services, each a boundary around one Concordium capability:

- ``identity_service``  proves a provider is a unique human, behind an adapter that is
                        either Veriox-backed or an honest stub.
- ``registry_service``  registers the agent and verifies its card with the five checks.
- ``x402_service``      builds payment requirements and settles through the packaged
                        ``@x402/concordium`` Server and Facilitator.
- ``audit_service``     keeps the Article 12 trail off chain and anchors only hashes.

None of them is configured for live use. No node endpoint, no Veriox path and no
facilitator has been issued, so every method either returns a ``not_configured``
result or raises ``NotConfiguredError``. Nothing here fabricates an address, a hash
or a successful call, and nothing performs I/O toward Concordium.
"""

from .audit_service import AUDIT_ACTIONS, AnchorResult, AuditService, payload_hash, safe_detail
from .identity_service import (
    IdentityAdapter,
    StubIdentityAdapter,
    VerioxIdentityAdapter,
    VerificationOutcome,
    VerificationRequestAnchor,
    build_identity_adapter,
)
from .registry_service import (
    BADGE_EXTENSION_KEY,
    BADGE_EXTENSION_VERSION,
    OFFICIAL_TESTNET_REGISTRY,
    STANDARD_NAME,
    AgentCard,
    CardCheck,
    CardVerification,
    RegistrationState,
    RegistryService,
    build_agent_card,
    verify_agent_card,
)
from .x402_service import (
    X402_PACKAGE,
    X402_SCHEME,
    X402_VERSION,
    ConcordiumX402Adapter,
    NotConfiguredX402Adapter,
    PaymentIntent,
    PaymentRequirements,
    PaymentSettlement,
    RuleResult,
    SignedPayload,
    X402Service,
    check_local_rules,
)

__all__ = [
    "AUDIT_ACTIONS",
    "AnchorResult",
    "AuditService",
    "BADGE_EXTENSION_KEY",
    "BADGE_EXTENSION_VERSION",
    "AgentCard",
    "CardCheck",
    "CardVerification",
    "ConcordiumX402Adapter",
    "IdentityAdapter",
    "NotConfiguredX402Adapter",
    "OFFICIAL_TESTNET_REGISTRY",
    "PaymentIntent",
    "PaymentRequirements",
    "PaymentSettlement",
    "RegistrationState",
    "RegistryService",
    "RuleResult",
    "STANDARD_NAME",
    "SignedPayload",
    "StubIdentityAdapter",
    "VerificationOutcome",
    "VerificationRequestAnchor",
    "VerioxIdentityAdapter",
    "X402Service",
    "X402_PACKAGE",
    "X402_SCHEME",
    "X402_VERSION",
    "build_agent_card",
    "build_identity_adapter",
    "check_local_rules",
    "payload_hash",
    "safe_detail",
    "verify_agent_card",
]
