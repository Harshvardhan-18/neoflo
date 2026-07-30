from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime

class AISummaryItem(BaseModel):
    id: UUID
    model: str
    summary_text: str
    tags: Optional[Dict[str, Any]] = None
    confidence: Optional[float] = None
    created_at: datetime

class ScreenshotItem(BaseModel):
    id: UUID
    storage_path: str
    data_url: Optional[str] = None
    domain: str
    captured_at: datetime
    summaries: List[AISummaryItem] = []

class EventItem(BaseModel):
    id: UUID
    type: str
    url: str
    domain: str
    tab_id: Optional[int] = None
    metadata: Optional[Dict[str, Any]] = None
    occurred_at: datetime

class ActivitySessionItem(BaseModel):
    session_id: UUID
    install_id: UUID
    started_at: datetime
    ended_at: Optional[datetime] = None
    events: List[EventItem] = []
    screenshots: List[ScreenshotItem] = []

class TimelineResponse(BaseModel):
    total: int
    page: int
    limit: int
    pages: int
    items: List[ActivitySessionItem]
