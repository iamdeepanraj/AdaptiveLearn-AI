from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel

class TopicMasterySummary(BaseModel):
    topic_id: int
    topic_name: str
    course_id: int
    course_name: str
    p_mastery: float
    mastery_state: str
    total_attempts: int
    correct_attempts: int
    accuracy: float
    next_review_due_at: Optional[datetime] = None
    is_due_for_review: bool = False

class MasteryHistoryPoint(BaseModel):
    timestamp: datetime
    p_mastery: float
    topic_name: str
    is_correct: bool

class RecommendationCard(BaseModel):
    id: int
    topic_id: int
    topic_name: str
    course_id: int
    recommendation_type: str
    title: str
    reason: str
    priority: int

class StudentDashboardSummary(BaseModel):
    overall_mastery: float
    topics_mastered_count: int
    topics_in_progress_count: int
    total_study_sessions: int
    total_questions_answered: int
    overall_accuracy: float
    mastery_threshold: float = 0.85
    weak_topics: List[TopicMasterySummary] = []
    strong_topics: List[TopicMasterySummary] = []
    upcoming_revisions: List[TopicMasterySummary] = []
    recommendations: List[RecommendationCard] = []
    mastery_timeline: List[MasteryHistoryPoint] = []

class DifficultConceptSummary(BaseModel):
    topic_id: int
    topic_name: str
    course_name: str
    average_mastery: float
    student_struggle_percentage: float
    common_misconceptions: List[str]
    total_attempts: int

class StudentProgressRow(BaseModel):
    student_id: int
    student_name: str
    email: str
    overall_mastery: float
    quizzes_taken: int
    last_active: Optional[datetime]
    weak_topic_count: int

class TeacherDashboardData(BaseModel):
    total_students: int
    total_courses: int
    average_class_mastery: float
    quizzes_completed_total: int
    difficult_concepts: List[DifficultConceptSummary] = []
    students: List[StudentProgressRow] = []
