from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict

class TopicBase(BaseModel):
    name: str
    code: Optional[str] = None
    description: Optional[str] = None
    order_index: int = 0

class TopicCreate(TopicBase):
    course_id: int
    prerequisite_ids: Optional[List[int]] = []

class TopicResponse(TopicBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    course_id: int
    created_at: datetime
    prerequisite_ids: List[int] = []

class CourseBase(BaseModel):
    code: str
    title: str
    description: Optional[str] = None

class CourseCreate(CourseBase):
    pass

class CourseResponse(CourseBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_by_id: Optional[int]
    created_at: datetime
    topics: List[TopicResponse] = []
    document_count: int = 0

class PrerequisiteGraphNode(BaseModel):
    id: int
    name: str
    code: Optional[str]
    mastery_prob: float = 0.0
    status: str = "locked"  # locked, available, learning, mastered

class PrerequisiteGraphEdge(BaseModel):
    source: int
    target: int

class PrerequisiteGraphResponse(BaseModel):
    nodes: List[PrerequisiteGraphNode]
    edges: List[PrerequisiteGraphEdge]
