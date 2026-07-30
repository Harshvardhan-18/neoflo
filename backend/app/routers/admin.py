from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.services.retention import purge_old_data

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])

@router.post("/retention/purge")
async def run_retention_purge(
    retention_days: int = Query(default=30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
):
    """
    Purges browsing sessions, events, screenshots, and AI summaries
    older than `retention_days` days (default: 30).
    """
    purged = await purge_old_data(db, retention_days=retention_days)
    return {"status": "ok", "purged_sessions": purged, "retention_days": retention_days}
