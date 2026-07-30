from pydantic import BaseModel
from uuid import UUID
from datetime import datetime

class PrivacyRuleCreate(BaseModel):
    domain: str
    action: str = "block" # block, allow

class PrivacyRuleResponse(BaseModel):
    id: UUID
    domain: str
    action: str
    created_at: datetime
