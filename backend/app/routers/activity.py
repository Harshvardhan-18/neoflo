import math
import uuid
from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies.auth import get_install_key
from app.models import BrowsingSession, Event, Screenshot, AISummary
from app.schemas.activity import (
    TimelineResponse,
    ActivitySessionItem,
    EventItem,
    ScreenshotItem,
    AISummaryItem
)

router = APIRouter(prefix="/api/v1/activity", tags=["Activity Feed"])

@router.get("/timeline", response_model=TimelineResponse)
async def get_activity_timeline(
    domain: Optional[str] = Query(None, description="Filter by domain"),
    from_date: Optional[datetime] = Query(None, description="Filter events from date"),
    to_date: Optional[datetime] = Query(None, description="Filter events to date"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    install_id: uuid.UUID = Depends(get_install_key),
    db: AsyncSession = Depends(get_db)
):
    offset = (page - 1) * limit

    # Build count and items query
    count_stmt = select(func.count(BrowsingSession.id)).where(BrowsingSession.install_id == install_id)
    if from_date:
        count_stmt = count_stmt.where(BrowsingSession.started_at >= from_date)
    if to_date:
        count_stmt = count_stmt.where(BrowsingSession.started_at <= to_date)

    total_result = await db.execute(count_stmt)
    total = total_result.scalar_one() or 0

    pages = math.ceil(total / limit) if total > 0 else 1

    query_stmt = (
        select(BrowsingSession)
        .where(BrowsingSession.install_id == install_id)
        .options(
            selectinload(BrowsingSession.events),
            selectinload(BrowsingSession.screenshots).selectinload(Screenshot.summaries)
        )
        .order_by(BrowsingSession.started_at.desc())
        .offset(offset)
        .limit(limit)
    )

    if from_date:
        query_stmt = query_stmt.where(BrowsingSession.started_at >= from_date)
    if to_date:
        query_stmt = query_stmt.where(BrowsingSession.started_at <= to_date)

    result = await db.execute(query_stmt)
    sessions = result.scalars().all()

    session_items = []
    for s in sessions:
        # Domain filtering on session's events/screenshots if domain parameter specified
        filtered_events = [e for e in s.events if not domain or e.domain.lower() == domain.lower()]
        filtered_screenshots = [sc for sc in s.screenshots if not domain or sc.domain.lower() == domain.lower()]

        if domain and not filtered_events and not filtered_screenshots:
            continue  # Skip session if domain filter provided and no matching records

        events_list = [
            EventItem(
                id=e.id,
                type=e.type,
                url=e.url,
                domain=e.domain,
                tab_id=e.tab_id,
                metadata=e.event_metadata,
                occurred_at=e.occurred_at
            )
            for e in filtered_events
        ]

        screenshots_list = [
            ScreenshotItem(
                id=sc.id,
                storage_path=sc.storage_path,
                domain=sc.domain,
                captured_at=sc.captured_at,
                summaries=[
                    AISummaryItem(
                        id=sum_item.id,
                        model=sum_item.model,
                        summary_text=sum_item.summary_text,
                        tags=sum_item.tags,
                        confidence=sum_item.confidence,
                        created_at=sum_item.created_at
                    )
                    for sum_item in sc.summaries
                ]
            )
            for sc in filtered_screenshots
        ]

        session_items.append(ActivitySessionItem(
            session_id=s.id,
            install_id=s.install_id,
            started_at=s.started_at,
            ended_at=s.ended_at,
            events=events_list,
            screenshots=screenshots_list
        ))

    return TimelineResponse(
        total=total,
        page=page,
        limit=limit,
        pages=pages,
        items=session_items
    )
