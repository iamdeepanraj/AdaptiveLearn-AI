from backend.app.schemas.auth import UserRegister, UserLogin, Token, UserResponse
from backend.app.schemas.course import CourseCreate, CourseResponse, TopicCreate, TopicResponse, PrerequisiteGraphResponse
from backend.app.schemas.document import DocumentResponse, DocumentChunkResponse, SourceCitation
from backend.app.schemas.chat import ChatMessageRequest, ChatMessageResponse, ConversationResponse
from backend.app.schemas.quiz import QuizStartRequest, QuizSessionResponse, AnswerSubmitRequest, QuizResponseResult, AssessmentReport
from backend.app.schemas.analytics import StudentDashboardSummary, TeacherDashboardData, TopicMasterySummary

__all__ = [
    "UserRegister", "UserLogin", "Token", "UserResponse",
    "CourseCreate", "CourseResponse", "TopicCreate", "TopicResponse", "PrerequisiteGraphResponse",
    "DocumentResponse", "DocumentChunkResponse", "SourceCitation",
    "ChatMessageRequest", "ChatMessageResponse", "ConversationResponse",
    "QuizStartRequest", "QuizSessionResponse", "AnswerSubmitRequest", "QuizResponseResult", "AssessmentReport",
    "StudentDashboardSummary", "TeacherDashboardData", "TopicMasterySummary"
]
