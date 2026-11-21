"""Database engine and session lifecycle, owned by the composition root.

Nothing in ``services`` may construct an engine or import ``asyncpg`` directly; a
service receives an ``AsyncSession`` it did not create. This module is the only
place a connection pool exists.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from .config import Settings
from .logging import get_logger

logger = get_logger("database")


class Base(DeclarativeBase):
    """Declarative base for every entity in ``app/models``."""


class Database:
    """The connection pool and its session factory for one process."""

    def __init__(self, settings: Settings) -> None:
        self._engine: AsyncEngine = create_async_engine(
            settings.DATABASE_URL,
            echo=settings.DATABASE_ECHO,
            pool_size=settings.DATABASE_POOL_SIZE,
            max_overflow=settings.DATABASE_MAX_OVERFLOW,
            pool_timeout=settings.DATABASE_POOL_TIMEOUT_SECONDS,
            pool_pre_ping=True,
        )
        self._session_factory = async_sessionmaker(
            self._engine, class_=AsyncSession, expire_on_commit=False
        )

    @property
    def engine(self) -> AsyncEngine:
        return self._engine

    @asynccontextmanager
    async def session(self) -> AsyncIterator[AsyncSession]:
        """One session, committed on success and rolled back on failure.

        The commit boundary is the use case, never the crud function: a crud
        function flushes and lets its caller decide.
        """
        session = self._session_factory()
        try:
            yield session
            await session.commit()
        except BaseException:
            await session.rollback()
            raise
        finally:
            await session.close()

    async def dispose(self) -> None:
        await self._engine.dispose()
        logger.info("database engine disposed")
