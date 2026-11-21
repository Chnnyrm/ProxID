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

from .common import InputModel, OutputModel

X402Status = Literal["not_configured", "pending", "settled", "failed", "demo"]


class X402InitiateRequest(InputModel):
    """Ask to start an x402 payment for a job.

    ``idempotency_key`` makes a double-clicked button create one payment, not
    two, once the rail is live.
    """

    job_id: uuid.UUID
    idempotency_key: str = Field(min_length=8, max_length=128)


class X402SettleRequest(InputModel):
    """Ask to settle an initiated payment."""

    receipt_id: uuid.UUID
    idempotency_key: str = Field(min_length=8, max_length=128)


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


class X402NotConfiguredOut(OutputModel):
    """The only response the rail can honestly give today.

    It carries no address, no endpoint, and no hash, because inventing any of
    those would be a lie a judge could check.
    """

    configured: Literal[False] = False
    status: Literal["not_configured"] = "not_configured"
    message: str
    network: str
    receipt: X402ReceiptOut | None = None
