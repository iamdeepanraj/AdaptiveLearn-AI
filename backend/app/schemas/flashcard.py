from typing import List, Optional
from pydantic import BaseModel

class FlashcardItem(BaseModel):
    id: str
    topic_id: int
    topic_name: str
    front: str
    back: str
    card_type: str  # "definition", "formula", "key_fact"
    document_id: Optional[int] = None
    document_name: str
    page: Optional[int] = None
    slide: Optional[int] = None
    timestamp: Optional[int] = None
    citation_text: str

class FlashcardDeckResponse(BaseModel):
    topic_id: int
    topic_name: str
    course_id: int
    cards: List[FlashcardItem]

class FlashcardReviewRequest(BaseModel):
    card_id: str
    topic_id: int
    knew_it: bool
    review_time_sec: Optional[float] = 5.0

class FlashcardReviewResponse(BaseModel):
    success: bool
    topic_id: int
    p_mastery_before: float
    p_mastery_after: float
    mastery_delta: float
    message: str
