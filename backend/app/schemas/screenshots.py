from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime

class ScreenshotCreate(BaseModel):
    id: UUID
    session_id: UUID
    event_id: Optional[UUID] = None
    data_url: str
    domain: str
    url: str
    captured_at: datetime

class ScreenshotResponse(BaseModel):
    status: str = "ok"
    screenshot_id: UUID
