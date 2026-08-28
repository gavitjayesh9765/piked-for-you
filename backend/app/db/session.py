"""Async engine and session factory."""

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

engine = create_async_engine(
    str(settings.DATABASE_URL),
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_pre_ping=True,
    echo=settings.DEBUG,
    # Fail fast instead of queueing behind an exhausted pool. The default is
    # 30s, which is twice the frontend's own upstream budget — so a request
    # that waited it out could only ever end as a timeout the caller had
    # already stopped listening for.
    pool_timeout=settings.DB_POOL_TIMEOUT,
    connect_args={
        # asyncpg's connect timeout. `pool_pre_ping` reconnects transparently
        # when a pooled connection has gone stale, and without this that
        # reconnect had no ceiling at all.
        "timeout": settings.DB_CONNECT_TIMEOUT,
        "command_timeout": settings.DB_STATEMENT_TIMEOUT,
    },
)

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)
