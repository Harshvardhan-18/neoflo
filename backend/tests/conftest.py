import pytest
import pytest_asyncio
from app.database import engine

@pytest_asyncio.fixture(autouse=True)
async def cleanup_db_engine():
    """
    Autouse fixture to dispose SQLAlchemy engine connections between tests,
    preventing loop contamination with asyncpg across sync/async test runs.
    """
    await engine.dispose()
    yield
    await engine.dispose()
