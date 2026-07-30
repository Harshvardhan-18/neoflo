import asyncio
import os
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Header, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models import BrowsingSession, Screenshot
from app.schemas.screenshots import ScreenshotCreate, ScreenshotResponse
from app.services.processor import process_screenshot_summary_background

router = APIRouter(prefix="/api/v1/screenshots", tags=["Screenshots"])

@router.post("", response_model=ScreenshotResponse)
async def upload_screenshot(
    payload: ScreenshotCreate,
    background_tasks: BackgroundTasks,
    x_install_key: Optional[str] = Header(None, alias="X-Install-Key"),
    db: AsyncSession = Depends(get_db)
):
    try:
        install_uuid = uuid.UUID(x_install_key) if x_install_key else uuid.uuid4()
    except ValueError:
        install_uuid = uuid.uuid4()

    # 1. Ensure browsing session exists
    session_stmt = select(BrowsingSession.id).where(BrowsingSession.id == payload.session_id)
    session_result = await db.execute(session_stmt)
    if not session_result.scalar_one_or_none():
        db.add(BrowsingSession(
            id=payload.session_id,
            install_id=install_uuid,
            started_at=payload.captured_at
        ))
        await db.flush()

    # 2. Save Screenshot record in Postgres
    # Storage path stores reference path or inline identifier
    storage_path = f"screenshots/{payload.session_id}/{payload.id}.jpg"

    screenshot = Screenshot(
        id=payload.id,
        session_id=payload.session_id,
        event_id=payload.event_id,
        storage_path=storage_path,
        data_url=payload.data_url,
        domain=payload.domain,
        captured_at=payload.captured_at
    )
    db.add(screenshot)
    await db.commit()

    # 3. Schedule asynchronous GPT-4o mini vision analysis background task
    background_tasks.add_task(
        process_screenshot_summary_background,
        screenshot_id=payload.id,
        data_url=payload.data_url,
        domain=payload.domain,
        url=payload.url
    )

    return ScreenshotResponse(status="ok", screenshot_id=payload.id)
