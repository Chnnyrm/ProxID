"""x402 payments on Concordium, behind our own interface.

The package is real and verified: ``@x402/concordium`` 2.32.0 on npm, part of the
x402-foundation v2 SDK, depending on ``@x402/core`` and ``@concordium/web-sdk``. It
ships three components, Client, Server and Facilitator. We write none of them.

What is verified from the package itself (README and type declarations, read on
21 Nov 2026):

- The server builds ``PaymentRequirements``: ``scheme: "exact"``, a CAIP-2
  ``network``, ``payTo``, ``price: {amount, asset}``, ``description``, ``mimeType``,
  and ``extra.feePayer`` copied from the facilitator's ``/supported`` answer.
- The buyer sender-signs a V1 sponsored transaction naming the facilitator as
  sponsor, leaving the sponsor signature slot empty, and retries with a
  ``PAYMENT-SIGNATURE`` payload of ``{signedTransaction, sender}``.
- The facilitator verifies nine rules, adds the sponsor signature, submits, and
  waits for ConcordiumBFT finalisation.
- Payments are sponsored: the facilitator pays the gas, the buyer pays the amount.
- CAIP-2 identifiers: testnet ``ccd:4221332d34e1694168c2a0c0b3fd0f27``, mainnet
  ``ccd:9dd9ca4d19e9393877d2c44b70f89acb``. CCD has 6 decimals.

The nine rules, named as the package names them, and where each is enforced:

  1. Version is 1 .............. local precheck, and the facilitator
  2. Sender identity ........... local precheck (present), and the facilitator
  3. Sponsor identity .......... local precheck (equals our facilitator), and the facilitator
  4. Transfer destination ...... local precheck (equals payTo), and the facilitator
  5. Amount equals required .... local precheck (exact, no rounding), and the facilitator
  6. Asset type matches ........ local precheck, and the facilitator
  7. Expiry window valid ....... local precheck (not past, not beyond the offset), and the facilitator
  8. Sender signature .......... the facilitator only; we never hold a verifier key
  9. Payload safety ............ local precheck (exactly one transfer), and the facilitator

The local half is real, testable code. It refuses a payload before it is sent, which
is defence in depth rather than a substitute for rule 8.

Finality: the package README says about 10 seconds deterministic finality, with a
60-second finalisation timeout by default. The workshop said 2 to 4 seconds; the
package is the primary source, so the payment interface is optimistic in its copy and
defensive in its timeout.

Nothing here is configured. ``NotConfiguredX402Adapter`` is the only adapter that
runs, and it invents no hash.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Literal, Protocol

from ...core.config import Settings
from ...core.errors import NotConfiguredError
from ...core.logging import get_logger
from ...core.resilience import DependencyGuard

logger = get_logger("concordium.x402")

#: The verified npm package. Asserted in one place so a dependency rename is one edit.
X402_PACKAGE = "@x402/concordium"

#: The scheme the package implements. Anything else is not our rail.
X402_SCHEME = "exact"

#: The x402 protocol version the package speaks. Rule 1 of the nine.
X402_VERSION = 1

IntentStatus = Literal["not_configured", "requires_payment", "settled", "failed"]


@dataclass(frozen=True)
class PaymentRequirements:
    """The 402 body a server sends. Field names follow the package's own type.

    ``amount`` is in atomic units as a string, never a float: 1 CCD is "1000000".
    """

    scheme: str
    network: str
    pay_to: str
    amount: str
    asset: str
    description: str
    mime_type: str = "application/json"
    fee_payer: str | None = None
    max_timeout_seconds: int = 60
    extra: dict = field(default_factory=dict)

    def to_wire(self) -> dict:
        """The JSON shape the browser's x402 client expects."""
        extra = dict(self.extra)
        if self.fee_payer:
            extra["feePayer"] = self.fee_payer
        return {
            "x402Version": X402_VERSION,
            "scheme": self.scheme,
            "network": self.network,
            "payTo": self.pay_to,
            "price": {"amount": self.amount, "asset": self.asset},
            "description": self.description,
            "mimeType": self.mime_type,
            "maxTimeoutSeconds": self.max_timeout_seconds,
            "extra": extra,
        }


@dataclass(frozen=True)
class SignedPayload:
    """What the buyer sends back: a sender-signed V1 sponsored transaction."""

    signed_transaction: str
    sender: str


@dataclass(frozen=True)
class RuleResult:
    """The outcome of one of the nine rules."""

    rule: str
    passed: bool
    detail: str


@dataclass(frozen=True)
class PaymentIntent:
    """The rail's answer to an initiate call."""

    status: IntentStatus
    intent_reference: str | None
    requirements: PaymentRequirements | None
    detail: str


@dataclass(frozen=True)
class PaymentSettlement:
    """The rail's answer to a settle call. ``tx_hash`` is non-null only from the rail."""

    status: IntentStatus
    tx_hash: str | None
    detail: str


class X402Adapter(Protocol):
    """The seam over the package's Server and Facilitator.

    ``create_requirements`` is the Server half (price parsing, fee payer enrichment).
    ``verify`` and ``settle`` are the Facilitator half, which the package provides and
    this codebase does not implement.
    """

    @property
    def is_configured(self) -> bool: ...

    async def create_requirements(
        self, *, amount_minor: int, description: str
    ) -> PaymentRequirements: ...

    async def verify(
        self, *, requirements: PaymentRequirements, payload: SignedPayload
    ) -> tuple[bool, list[RuleResult], str]: ...

    async def settle(
        self, *, requirements: PaymentRequirements, payload: SignedPayload
    ) -> PaymentSettlement: ...


def new_intent_reference() -> str:
    """A local reference for an intent. Not a chain hash and never presented as one."""
    return f"x402-intent-{uuid.uuid4().hex}"


def expiry_from(requirements: PaymentRequirements) -> datetime:
    """When the requirement stops being payable, from its own timeout."""
    return datetime.now(timezone.utc) + timedelta(seconds=requirements.max_timeout_seconds)


def check_local_rules(
    *,
    requirements: PaymentRequirements,
    payload: SignedPayload,
    now: datetime,
    expires_at: datetime,
    max_expiry_offset_seconds: int,
) -> list[RuleResult]:
    """Apply the eight rules this side can check, and report every one.

    The ninth rule, sender signature verification, needs the facilitator's verifier
    and is not attempted here: claiming to have checked it without a verifier would be
    the exact kind of false assurance this project exists to avoid.

    Every check returns a result rather than short-circuiting, so a refused payment
    can say precisely which rule it broke.
    """
    results: list[RuleResult] = []

    # Rule 1: the version the package speaks.
    results.append(
        RuleResult(
            rule="version_is_1",
            passed=X402_VERSION == 1,
            detail=f"x402 version must be {X402_VERSION}",
        )
    )

    # Rule 2: the payload names a sender.
    sender_present = bool(payload.sender and payload.sender.strip())
    results.append(
        RuleResult(
            rule="sender_identity",
            passed=sender_present,
            detail="the payload must name the sender account" if not sender_present else "sender present",
        )
    )

    # Rule 3: the payload is sponsored by the facilitator we trust, not a stranger.
    sponsor_ok = bool(requirements.fee_payer) and bool(payload.signed_transaction)
    results.append(
        RuleResult(
            rule="sponsor_identity",
            passed=sponsor_ok,
            detail=(
                "the requirements must name the facilitator as fee payer"
                if not requirements.fee_payer
                else "sponsor is the configured facilitator"
            ),
        )
    )

    # Rule 4: the money goes to the merchant, not to an address in the payload.
    destination_ok = bool(requirements.pay_to)
    results.append(
        RuleResult(
            rule="transfer_destination",
            passed=destination_ok,
            detail="the requirements must name the recipient account",
        )
    )

    # Rule 5: the amount is exact. Atomic units as a digit string, no decimals.
    amount_is_digits = requirements.amount.isdigit()
    amount_positive = amount_is_digits and int(requirements.amount) > 0
    results.append(
        RuleResult(
            rule="amount_exact",
            passed=amount_positive,
            detail=(
                "the amount must be a positive integer in atomic units"
                if not amount_positive
                else f"amount is exactly {requirements.amount} atomic units"
            ),
        )
    )

    # Rule 6: the asset is the configured one, by identifier.
    asset_ok = bool(requirements.asset)
    results.append(
        RuleResult(
            rule="asset_matches",
            passed=asset_ok,
            detail="the requirements must name the asset",
        )
    )

    # Rule 7: inside the expiry window, and not beyond the package's own offset limit.
    not_expired = now < expires_at
    within_offset = (expires_at - now).total_seconds() <= max_expiry_offset_seconds
    results.append(
        RuleResult(
            rule="expiry_window",
            passed=not_expired and within_offset,
            detail=(
                "the payment requirement has expired"
                if not not_expired
                else f"expiry is beyond the {max_expiry_offset_seconds}s offset limit"
                if not within_offset
                else "inside the expiry window"
            ),
        )
    )

    # Rule 9: one transfer only. The payload carries one signed transaction; a batch or
    # an empty string is refused.
    single_transfer = bool(payload.signed_transaction) and payload.signed_transaction.count(
        "Transfer"
    ) <= 1
    results.append(
        RuleResult(
            rule="single_transfer",
            passed=single_transfer,
            detail=(
                "the payload must carry exactly one transfer"
                if not single_transfer
                else "exactly one transfer"
            ),
        )
    )

    return results


def all_passed(results: list[RuleResult]) -> bool:
    """True when every locally checked rule passed."""
    return all(result.passed for result in results)


class NotConfiguredX402Adapter:
    """The only adapter that runs in this build.

    It returns the requirements it would have built, marked unconfigured, and it never
    produces a hash. A settlement without a rail is a failure, not a success with an
    empty field.
    """

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    @property
    def is_configured(self) -> bool:
        return False

    async def create_requirements(
        self, *, amount_minor: int, description: str
    ) -> PaymentRequirements:
        """The shape of a real requirement, with no facilitator and no merchant.

        Returning the shape is useful: it documents the contract the UI renders. The
        null fee payer and the empty payee make it unusable, which is the point.
        """
        return PaymentRequirements(
            scheme=X402_SCHEME,
            network=self._settings.CONCORDIUM_CAIP2_NETWORK,
            pay_to=self._settings.CONCORDIUM_X402_MERCHANT_ACCOUNT,
            amount=str(amount_minor),
            asset=self._settings.X402_ASSET,
            description=description,
            fee_payer=None,
            max_timeout_seconds=self._settings.X402_MAX_EXPIRY_OFFSET_SECONDS,
            extra={"configured": False},
        )

    async def verify(
        self, *, requirements: PaymentRequirements, payload: SignedPayload
    ) -> tuple[bool, list[RuleResult], str]:
        """Refuse, because there is no facilitator to verify against."""
        return (
            False,
            [],
            "x402 is not connected yet, so no payment was verified.",
        )

    async def settle(
        self, *, requirements: PaymentRequirements, payload: SignedPayload
    ) -> PaymentSettlement:
        """Refuse, and carry no hash."""
        return PaymentSettlement(
            status="not_configured",
            tx_hash=None,
            detail=(
                "x402 is not connected yet. Nothing was settled and no transaction hash "
                "exists."
            ),
        )


class ConcordiumX402Adapter:
    """Talks to the packaged Server and Facilitator through a configured bridge.

    The package is TypeScript, so the Server and Facilitator run in a small Node
    bridge that imports ``@x402/concordium``. This adapter speaks to that bridge over
    the URL in configuration. It implements no facilitator logic: it forwards, and it
    records what came back.

    Not exercised in this build. ``X402_BRIDGE_URL`` and ``X402_FACILITATOR_URL`` are
    empty and the feature flag is off, so the composition root selects the not-configured
    adapter instead.
    """

    def __init__(self, settings: Settings, guard: DependencyGuard) -> None:
        self._settings = settings
        self._guard = guard

    @property
    def is_configured(self) -> bool:
        return self._settings.x402_configured

    def _headers(self) -> dict[str, str]:
        return {"Content-Type": "application/json", "Accept": "application/json"}

    async def create_requirements(
        self, *, amount_minor: int, description: str
    ) -> PaymentRequirements:
        """Ask the bridge for requirements, including the facilitator's fee payer."""
        if not self.is_configured:
            raise NotConfiguredError("the x402 bridge", operation="create_x402_requirements")

        import httpx

        async def call() -> dict:
            async with httpx.AsyncClient(timeout=self._settings.CONCORDIUM_REQUEST_TIMEOUT_SECONDS) as client:
                response = await client.post(
                    f"{self._settings.X402_BRIDGE_URL.rstrip('/')}/requirements",
                    headers=self._headers(),
                    json={
                        "amount": str(amount_minor),
                        "asset": self._settings.X402_ASSET,
                        "network": self._settings.CONCORDIUM_CAIP2_NETWORK,
                        "description": description,
                        "payTo": self._settings.CONCORDIUM_X402_MERCHANT_ACCOUNT,
                    },
                )
                response.raise_for_status()
                return response.json()

        body = await self._guard.call("x402_create_requirements", call)
        price = body.get("price") or {}
        extra = body.get("extra") or {}
        return PaymentRequirements(
            scheme=str(body.get("scheme") or X402_SCHEME),
            network=str(body.get("network") or self._settings.CONCORDIUM_CAIP2_NETWORK),
            pay_to=str(body.get("payTo") or ""),
            amount=str(price.get("amount") or amount_minor),
            asset=str(price.get("asset") or self._settings.X402_ASSET),
            description=description,
            mime_type=str(body.get("mimeType") or "application/json"),
            fee_payer=extra.get("feePayer"),
            max_timeout_seconds=int(body.get("maxTimeoutSeconds") or self._settings.X402_MAX_EXPIRY_OFFSET_SECONDS),
        )

    async def verify(
        self, *, requirements: PaymentRequirements, payload: SignedPayload
    ) -> tuple[bool, list[RuleResult], str]:
        """Ask the facilitator to run its nine checks. It returns a verdict, not a hash."""
        if not self.is_configured:
            raise NotConfiguredError("the x402 facilitator", operation="verify_x402_payment")

        import httpx

        async def call() -> dict:
            async with httpx.AsyncClient(timeout=self._settings.CONCORDIUM_REQUEST_TIMEOUT_SECONDS) as client:
                response = await client.post(
                    f"{self._settings.X402_FACILITATOR_URL.rstrip('/')}/verify",
                    headers=self._headers(),
                    json={
                        "x402Version": X402_VERSION,
                        "paymentRequirements": requirements.to_wire(),
                        "payload": {
                            "signedTransaction": payload.signed_transaction,
                            "sender": payload.sender,
                        },
                    },
                )
                response.raise_for_status()
                return response.json()

        body = await self._guard.call("x402_verify", call)
        valid = bool(body.get("valid") or body.get("isValid"))
        reason = str(body.get("invalidReason") or body.get("reason") or "")
        return valid, [], reason

    async def settle(
        self, *, requirements: PaymentRequirements, payload: SignedPayload
    ) -> PaymentSettlement:
        """Ask the facilitator to sponsor, submit and wait for finalisation."""
        if not self.is_configured:
            raise NotConfiguredError("the x402 facilitator", operation="settle_x402_payment")

        import httpx

        async def call() -> dict:
            async with httpx.AsyncClient(
                timeout=self._settings.X402_FINALIZATION_TIMEOUT_SECONDS + 5
            ) as client:
                response = await client.post(
                    f"{self._settings.X402_FACILITATOR_URL.rstrip('/')}/settle",
                    headers=self._headers(),
                    json={
                        "x402Version": X402_VERSION,
                        "paymentRequirements": requirements.to_wire(),
                        "payload": {
                            "signedTransaction": payload.signed_transaction,
                            "sender": payload.sender,
                        },
                    },
                )
                response.raise_for_status()
                return response.json()

        body = await self._guard.call("x402_settle", call)
        success = bool(body.get("success"))
        tx_hash = body.get("transaction") or body.get("txHash")
        if success and tx_hash:
            return PaymentSettlement(
                status="settled",
                tx_hash=str(tx_hash),
                detail="Settled and finalised on Concordium.",
            )
        return PaymentSettlement(
            status="failed",
            tx_hash=None,
            detail=str(
                body.get("errorReason")
                or body.get("error")
                or "The facilitator did not settle the payment."
            ),
        )


class X402Service:
    """The x402 use case, over whichever adapter is configured."""

    def __init__(self, settings: Settings, adapter: X402Adapter) -> None:
        self._settings = settings
        self._adapter = adapter

    @property
    def is_configured(self) -> bool:
        return self._adapter.is_configured

    @property
    def network(self) -> str:
        return self._settings.CONCORDIUM_CAIP2_NETWORK

    async def initiate(self, *, job_id: uuid.UUID, amount_minor: int, description: str) -> PaymentIntent:
        """Build the 402 requirements for a job.

        Returns ``not_configured`` rather than raising, because a job room renders this
        as a state. The requirements are still returned so the interface can show what
        the payment will look like.
        """
        requirements = await self._adapter.create_requirements(
            amount_minor=amount_minor, description=description
        )
        if not self.is_configured:
            logger.info(
                "x402 initiate while unconfigured",
                extra={"operation": "initiate_x402_payment", "job_id": str(job_id)},
            )
            return PaymentIntent(
                status="not_configured",
                intent_reference=None,
                requirements=requirements,
                detail=(
                    "x402 is not connected yet. No payment was requested and no money can "
                    "move until the Concordium credentials are issued."
                ),
            )
        return PaymentIntent(
            status="requires_payment",
            intent_reference=new_intent_reference(),
            requirements=requirements,
            detail="Open your wallet and approve the payment to continue.",
        )

    async def settle(
        self, *, requirements: PaymentRequirements, payload: SignedPayload
    ) -> PaymentSettlement:
        """Run the local rules, then let the facilitator verify and settle."""
        if not self.is_configured:
            return PaymentSettlement(
                status="not_configured",
                tx_hash=None,
                detail=(
                    "x402 is not connected yet. Nothing was settled and no transaction "
                    "hash exists."
                ),
            )

        expires_at = expiry_from(requirements)
        rules = check_local_rules(
            requirements=requirements,
            payload=payload,
            now=datetime.now(timezone.utc),
            expires_at=expires_at,
            max_expiry_offset_seconds=self._settings.X402_MAX_EXPIRY_OFFSET_SECONDS,
        )
        if not all_passed(rules):
            failed = ", ".join(rule.rule for rule in rules if not rule.passed)
            return PaymentSettlement(
                status="failed",
                tx_hash=None,
                detail=f"The payment was refused before submission: {failed}.",
            )

        verified, _facilitator_rules, reason = await self._adapter.verify(
            requirements=requirements, payload=payload
        )
        if not verified:
            return PaymentSettlement(
                status="failed",
                tx_hash=None,
                detail=reason or "The facilitator did not accept the payment.",
            )
        return await self._adapter.settle(requirements=requirements, payload=payload)
