from datetime import datetime
from typing import List, Optional, Any, Dict
from pydantic import BaseModel
from backend.app.schemas.document import SourceCitation

class QuestionOption(BaseModel):
    key: str
    text: str

class QuestionStudentView(BaseModel):
    id: int
    topic_id: int
    topic_name: str
    question_type: str
    difficulty: str
    question_text: str
    options: Optional[List[QuestionOption]] = None
    # Notice: correct_answer is strictly omitted here to protect test integrity!

class QuizStartRequest(BaseModel):
    course_id: int
    topic_ids: Optional[List[int]] = None
    question_types: Optional[List[str]] = None  # ["mcq", "short_answer", "numerical"]
    difficulty_mode: str = "adaptive"  # adaptive, easy, medium, hard
    question_count: int = 5
    is_diagnostic: bool = False

class QuizSessionResponse(BaseModel):
    id: int
    course_id: int
    title: str
    status: str
    difficulty_mode: str
    total_questions: int
    is_diagnostic: bool
    started_at: datetime
    questions: List[QuestionStudentView] = []

class AnswerSubmitRequest(BaseModel):
    quiz_session_id: int
    question_id: int
    answer: str
    response_time_sec: Optional[float] = None
    confidence_level: Optional[str] = "medium"

class QuizResponseResult(BaseModel):
    response_id: int
    question_id: int
    is_correct: bool
    score_awarded: float
    correct_answer: str
    explanation: str
    feedback: str
    feedback_citations: List[SourceCitation] = []
    misconception_tag: Optional[str] = None
    
    # Graded MCQ specifics
    option_label: Optional[str] = None  # "correct", "partial", "wrong"
    option_score: Optional[float] = None
    option_rationale: Optional[str] = None
    missing_detail: Optional[str] = None
    revealed_options: Optional[List[Dict[str, Any]]] = None

    # Keyword Short Answer specifics
    covered_keywords: Optional[List[str]] = None
    missing_keywords: Optional[List[str]] = None

    # BKT Mastery & Understanding update feedback
    topic_id: int
    topic_name: str
    p_mastery_before: float
    p_mastery_after: float
    mastery_delta: float
    new_mastery_state: str
    running_understanding_score: Optional[float] = None
    understanding_level: Optional[str] = None


class AssessmentTopicBreakdown(BaseModel):
    topic_id: int
    topic_name: str
    questions_attempted: int
    questions_correct: int
    accuracy_percentage: float
    p_mastery: float
    mastery_state: str
    status: str  # "strength", "developing", "weak"

class AssessmentReport(BaseModel):
    quiz_session_id: int
    course_title: str
    total_questions: int
    correct_count: int
    score_percentage: float
    completed_at: datetime
    topic_breakdowns: List[AssessmentTopicBreakdown]
    identified_misconceptions: List[str]
    strengths: List[str]
    recommended_next_steps: List[str]
