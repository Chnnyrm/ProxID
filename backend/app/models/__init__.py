"""SQLAlchemy entities and the shared declarative base.

Importing this package registers every table on ``Base.metadata``, which is what
Alembic's autogenerate and the test fixtures need.
"""

from ..core.database import Base
from .agent_log import AgentToolLog
from .category import Category
from .job import JOB_STATUSES, TERMINAL_JOB_STATUSES, Job
from .message import MESSAGE_AUTHORS, JobMessage
from .service import ServiceListing
from .user import USER_ROLES, User, UserSession
from .x402_receipt import X402_RECEIPT_STATUSES, X402Receipt

__all__ = [
    "Base",
    "AgentToolLog",
    "Category",
    "Job",
    "JOB_STATUSES",
    "TERMINAL_JOB_STATUSES",
    "JobMessage",
    "MESSAGE_AUTHORS",
    "ServiceListing",
    "User",
    "UserSession",
    "USER_ROLES",
    "X402Receipt",
    "X402_RECEIPT_STATUSES",
]
