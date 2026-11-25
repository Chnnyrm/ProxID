"""SQLAlchemy entities and the shared declarative base.

Importing this package registers every table on ``Base.metadata``, which is what
Alembic's autogenerate and the test fixtures need.
"""

from ..core.database import Base
from .agent_conversation import AgentConversation, AgentTurn
from .agent_log import AgentToolLog
from .audit_event import AUDIT_OUTCOMES, AuditEvent
from .category import Category
from .job import JOB_STATUSES, TERMINAL_JOB_STATUSES, Job
from .message import MESSAGE_AUTHORS, JobMessage
from .notification import Notification
from .push_subscription import PushSubscription
from .service import ServiceListing
from .user import USER_ROLES, User, UserSession
from .verification_request import VERIFICATION_PURPOSES, VERIFICATION_STATUSES, VerificationRequest
from .x402_receipt import X402_RECEIPT_STATUSES, X402Receipt

__all__ = [
    "Base",
    "AgentConversation",
    "AgentTurn",
    "AgentToolLog",
    "AUDIT_OUTCOMES",
    "AuditEvent",
    "Category",
    "Job",
    "JOB_STATUSES",
    "TERMINAL_JOB_STATUSES",
    "JobMessage",
    "MESSAGE_AUTHORS",
    "Notification",
    "PushSubscription",
    "ServiceListing",
    "User",
    "UserSession",
    "USER_ROLES",
    "VERIFICATION_PURPOSES",
    "VERIFICATION_STATUSES",
    "VerificationRequest",
    "X402Receipt",
    "X402_RECEIPT_STATUSES",
]
