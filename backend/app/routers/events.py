from fastapi import APIRouter, Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
import uuid

from app.database import get_db
from app.models import BrowsingSession, Event
from app.schemas.events import EventBatchRequest, EventBatchResponse

router = APIRouter(prefix="/api/v1/events", tags=["Events"])

@router.post("/batch", response_model=EventBatchResponse)
async def ingest_events_batch(
    payload: EventBatchRequest,
    x_install_key: Optional[str] = Header(None, alias="X-Install-Key"),
    db: AsyncSession = Depends(get_db)
):
    if not payload.events:
        return EventBatchResponse(status="ok", count=0)

    try:
        install_uuid = uuid.UUID(x_install_key) if x_install_key else uuid.uuid4()
    except ValueError:
        install_uuid = uuid.uuid4()

    # Collect session IDs from batch and ensure sessions exist in DB
    session_ids = {item.session_id for item in payload.events}
    
    existing_stmt = select(BrowsingSession.id).where(BrowsingSession.id.in_(session_ids))
    result = await db.execute(existing_stmt)
    existing_session_ids = set(result.scalars().all())

    # Auto-create missing session records for new install/session
    missing_session_ids = session_ids - existing_session_ids
    for sid in missing_session_ids:
        db.add(BrowsingSession(
            id=sid,
            install_id=install_uuid,
            started_at=payload.events[0].occurred_at
        ))
    
    # Construct Event ORM objects explicitly mapping Pydantic metadata -> ORM event_metadata
    event_objects = []
    for item in payload.events:
        event_objects.append(Event(
            id=item.id,
            session_id=item.session_id,
            type=item.type,
            url=item.url,
            domain=item.domain,
            tab_id=item.tab_id,
            event_metadata=item.metadata, # Explicit mapping: Pydantic item.metadata -> ORM event_metadata
            occurred_at=item.occurred_at
        ))

    db.add_all(event_objects)
    await db.commit()

    return EventBatchResponse(status="ok", count=len(event_objects))
