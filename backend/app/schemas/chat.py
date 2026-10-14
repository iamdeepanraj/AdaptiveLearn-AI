from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict
from backend.app.schemas.document import SourceCitation

class ChatMessageRequest(BaseModel):
    course_id: int
    conversation_id: Optional[int] = None
    topic_id: Optional[int] = None
    message: str
    allow_outside_knowledge: bool = False

class ChatMessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    conversation_id: int
    role: str
    content: str
    citations: List[SourceCitation] = []
    is_grounded: bool
    has_insufficient_evidence: bool
    created_at: datetime

class ConversationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    course_id: int
    title: str
    created_at: datetime
    updated_at: datetime
    messages: List[ChatMessageResponse] = []
