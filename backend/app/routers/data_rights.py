import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies.auth import get_install_key
from app.models import BrowsingSession, Event, Screenshot, AISummary
from app.schemas.data_rights import DataExportResponse, DataDeleteResponse

router = APIRouter(prefix="/api/v1/data", tags=["User Data Rights"])

@router.post("/export", response_model=DataExportResponse)
async def export_user_data(
    install_id: uuid.UUID = Depends(get_install_key),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(BrowsingSession)
        .where(BrowsingSession.install_id == install_id)
        .options(
            selectinload(BrowsingSession.events),
            selectinload(BrowsingSession.screenshots).selectinload(Screenshot.summaries)
        )
    )
    result = await db.execute(stmt)
    sessions = result.scalars().all()

    exported_sessions = []
    total_events = 0
    total_screenshots = 0

    for s in sessions:
        events_data = [
            {
                "id": str(e.id),
                "type": e.type,
                "url": e.url,
                "domain": e.domain,
                "tab_id": e.tab_id,
                "metadata": e.event_metadata,
                "occurred_at": e.occurred_at.isoformat()
            }
            for e in s.events
        ]
        total_events += len(events_data)

        screenshots_data = [
            {
                "id": str(sc.id),
                "storage_path": sc.storage_path,
                "domain": sc.domain,
                "captured_at": sc.captured_at.isoformat(),
                "summaries": [
                    {
                        "id": str(sum_item.id),
                        "model": sum_item.model,
                        "summary_text": sum_item.summary_text,
                        "tags": sum_item.tags,
                        "confidence": sum_item.confidence,
                        "created_at": sum_item.created_at.isoformat()
                    }
                    for sum_item in sc.summaries
                ]
            }
            for sc in s.screenshots
        ]
        total_screenshots += len(screenshots_data)

        exported_sessions.append({
            "session_id": str(s.id),
            "started_at": s.started_at.isoformat(),
            "ended_at": s.ended_at.isoformat() if s.ended_at else None,
            "events": events_data,
            "screenshots": screenshots_data
        })

    return DataExportResponse(
        install_id=install_id,
        exported_at=datetime.now(timezone.utc),
        sessions_count=len(exported_sessions),
        events_count=total_events,
        screenshots_count=total_screenshots,
        data={"sessions": exported_sessions}
    )

@router.post("/delete", response_model=DataDeleteResponse)
async def delete_user_data(
    install_id: uuid.UUID = Depends(get_install_key),
    db: AsyncSession = Depends(get_db)
):
    # Fetch sessions for count before cascade delete
    stmt = select(BrowsingSession.id).where(BrowsingSession.install_id == install_id)
    result = await db.execute(stmt)
    session_ids = result.scalars().all()

    if not session_ids:
        return DataDeleteResponse(
            status="success",
            install_id=install_id,
            deleted_records={"sessions": 0, "events": 0, "screenshots": 0}
        )

    # Delete sessions (Cascade will delete events, screenshots, and ai_summaries)
    del_stmt = delete(BrowsingSession).where(BrowsingSession.install_id == install_id)
    await db.execute(del_stmt)
    await db.commit()

    return DataDeleteResponse(
        status="success",
        install_id=install_id,
        deleted_records={"sessions": len(session_ids)}
    )
