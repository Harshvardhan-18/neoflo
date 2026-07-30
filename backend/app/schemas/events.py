from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime

class EventCreate(BaseModel):
    id: UUID
    session_id: UUID
    type: str
    url: str
    domain: str
    tab_id: Optional[int] = None
    metadata: Optional[Dict[str, Any]] = None
    occurred_at: datetime

class EventBatchRequest(BaseModel):
    events: List[EventCreate]

class EventBatchResponse(BaseModel):
    status: str = "ok"
    count: int
