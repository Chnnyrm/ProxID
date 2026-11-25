"""Version 1 router: mounts every endpoint module under its prefix."""

from __future__ import annotations

from fastapi import APIRouter

from .endpoints import (
    agent,
    auth,
    categories,
    health,
    jobs,
    location,
    messages,
    notifications,
    payments,
    push,
    services,
    upload,
    users,
    verification,
)

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(upload.router, prefix="/upload", tags=["upload"])
api_router.include_router(categories.router, prefix="/categories", tags=["categories"])
api_router.include_router(services.router, prefix="/services", tags=["services"])
api_router.include_router(jobs.router, prefix="/jobs", tags=["jobs"])
api_router.include_router(messages.router, prefix="/messages", tags=["messages"])
api_router.include_router(agent.router, prefix="/agent", tags=["agent"])
api_router.include_router(payments.router, prefix="/payments", tags=["payments"])
api_router.include_router(location.router, prefix="/location", tags=["location"])
api_router.include_router(verification.router, prefix="/verification", tags=["verification"])
api_router.include_router(push.router, prefix="/push", tags=["push"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
api_router.include_router(health.router, prefix="/health", tags=["health"])
