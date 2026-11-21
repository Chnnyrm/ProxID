"""x402 payment contracts.

Every response in this module can say ``not_configured``. That is not an error
state to be hidden: it is the honest answer until the Concordium credentials
exist, and the shape of the response makes that unmissable.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import Field

from .base import InputModel, OutputModel

X402Status = Literal["not_configured", "pending", "settled", "failed", "demo"]


class X402InitiateRequest(InputModel):
    """Ask to start an x402 payment for a job.

    ``idempotency_key`` makes a double-clicked button create one payment, not
    two, once the rail is live.
    """

    job_id: uuid.UUID
    idempotency_key: str = Field(min_length=8, max_length=128)


class X402SettleRequest(InputModel):
    """Ask to settle an initiated payment.

    ``signed_transaction`` and ``sender`` are what the buyer's wallet returns: a
    sender-signed V1 sponsored transaction naming the facilitator as sponsor, and the
    sender account. Omitted, there is nothing to verify and the caller is told so.
    """

    receipt_id: uuid.UUID
    idempotency_key: str = Field(min_length=8, max_length=128)
    signed_transaction: str | None = Field(default=None, max_length=200_000)
    sender: str | None = Field(default=None, max_length=64)


class X402ReceiptOut(OutputModel):
    """A payment record, including the ones that never left the building."""

    id: uuid.UUID
    job_id: uuid.UUID
    amount: float
    currency: str
    status: str
    network: str
    x402_tx_hash: str | None = None
    payer_account: str | None = None
    payee_account: str | None = None
    is_demo: bool = False
    failure_reason: str | None = None
    created_at: datetime
    settled_at: datetime | None = None


class X402ActionOut(OutputModel):
    """The result of asking the rail to do something.

    One shape for every state, so a client written today keeps working when the
    rail arrives. In this build ``configured`` is always false and ``status`` is
    always ``not_configured``: no address, no endpoint and no hash is invented,
    because inventing any of them would be a lie a judge could check.
    """

    configured: bool
    status: X402Status
    message: str
    network: str
    receipt: X402ReceiptOut | None = None


class X402RequirementsOut(OutputModel):
    """The 402 body, in the shape the packaged server builds.

    Shown to a client so the interface can render what a payment would look like,
    even while no rail is connected.
    """

    x402Version: int
    scheme: str
    network: str
    payTo: str
    price: dict
    description: str
    mimeType: str
    maxTimeoutSeconds: int
    extra: dict
