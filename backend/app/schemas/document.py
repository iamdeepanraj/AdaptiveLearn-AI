from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict

class DocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    course_id: int
    filename: str
    file_type: str
    file_size_bytes: int
    status: str
    page_or_slide_count: int
    error_message: Optional[str] = None
    extracted_metadata: Dict[str, Any] = {}
    created_at: datetime

class DocumentChunkResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    document_id: int
    course_id: int
    topic_id: Optional[int] = None
    chunk_index: int
    content: str
    page_number: Optional[int] = None
    slide_number: Optional[int] = None
    timestamp_start_sec: Optional[int] = None
    timestamp_end_sec: Optional[int] = None
    source_type: str
    figure_description: Optional[str] = None

class SourceCitation(BaseModel):
    chunk_id: int
    document_id: int
    document_name: str
    source_type: str
    page: Optional[int] = None
    slide: Optional[int] = None
    timestamp_start: Optional[int] = None
    timestamp_end: Optional[int] = None
    quote: str
    figure_description: Optional[str] = None
    similarity_score: Optional[float] = None
