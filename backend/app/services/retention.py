import logging
from datetime import datetime, timedelta, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.models import BrowsingSession

logger = logging.getLogger("visual_ai_agent.retention")

async def purge_old_data(db: AsyncSession, retention_days: int = 30) -> int:
    """
    Purges browsing sessions, events, screenshots, and AI summaries older than retention_days.
    """
    cutoff_date = datetime.now(timezone.utc) - timedelta(days=retention_days)
    
    # Query matching sessions
    stmt = select(BrowsingSession.id).where(BrowsingSession.started_at < cutoff_date)
    result = await db.execute(stmt)
    expired_ids = result.scalars().all()

    if not expired_ids:
        logger.info(f"No expired sessions found older than {retention_days} days.")
        return 0

    # Delete expired sessions (Cascade deletes events, screenshots, and ai_summaries)
    del_stmt = delete(BrowsingSession).where(BrowsingSession.started_at < cutoff_date)
    await db.execute(del_stmt)
    await db.commit()

    logger.info(f"Purged {len(expired_ids)} sessions older than {cutoff_date.isoformat()} ({retention_days} days).")
    return len(expired_ids)
