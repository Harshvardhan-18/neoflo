from pydantic import BaseModel
from typing import Dict, Any
from uuid import UUID
from datetime import datetime

class DataExportResponse(BaseModel):
    install_id: UUID
    exported_at: datetime
    sessions_count: int
    events_count: int
    screenshots_count: int
    data: Dict[str, Any]

class DataDeleteResponse(BaseModel):
    status: str = "success"
    install_id: UUID
    deleted_records: Dict[str, int]
