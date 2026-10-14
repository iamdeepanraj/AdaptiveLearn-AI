import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum, JSON, Boolean, Float
from sqlalchemy.orm import relationship
from backend.app.database import Base

class QuestionType(str, enum.Enum):
    MCQ = "mcq"
    SHORT_ANSWER = "short_answer"
    NUMERICAL = "numerical"

class DifficultyLevel(str, enum.Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"

class QuizStatus(str, enum.Enum):
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"

class Question(Base):
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False, index=True)
    topic_id = Column(Integer, ForeignKey("topics.id"), nullable=False, index=True)
    question_type = Column(Enum(QuestionType), nullable=False)
    difficulty = Column(Enum(DifficultyLevel), default=DifficultyLevel.MEDIUM, nullable=False)
    
    question_text = Column(Text, nullable=False)
    # Options for MCQ: [{"key": "A", "text": "..."}]
    options = Column(JSON, nullable=True)
    correct_answer = Column(Text, nullable=False)
    numerical_tolerance = Column(Float, default=0.01) # e.g. +/- 1%
    explanation = Column(Text, nullable=False)
    
    # Stable content fingerprint (SHA-256 of normalized question text) to avoid duplicates
    fingerprint = Column(String(64), unique=True, index=True, nullable=False)
    
    # Source citations reference: [{"document_id": int, "page": int, "slide": int, "excerpt": str}]
    source_citations = Column(JSON, default=list)
    is_verified = Column(Boolean, default=True)
    verification_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    course = relationship("Course", back_populates="questions")
    topic = relationship("Topic", back_populates="questions")
    responses = relationship("QuizResponse", back_populates="question")

class QuizSession(Base):
    __tablename__ = "quiz_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False, index=True)
    title = Column(String(255), default="Adaptive Assessment")
    status = Column(Enum(QuizStatus), default=QuizStatus.IN_PROGRESS)
    
    # Selected configuration
    target_topics = Column(JSON, default=list)  # list of topic_ids
    difficulty_mode = Column(String(50), default="adaptive")  # adaptive, easy, medium, hard
    total_questions = Column(Integer, default=5)
    score = Column(Float, default=0.0)
    max_score = Column(Float, default=0.0)
    
    # Diagnostic assessment flag
    is_diagnostic = Column(Boolean, default=False)
    
    # Summary report of strengths & misconceptions
    assessment_report = Column(JSON, nullable=True)
    
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    # Relationships
    user = relationship("User", back_populates="quiz_sessions")
    responses = relationship("QuizResponse", back_populates="quiz_session", cascade="all, delete-orphan")

class QuizResponse(Base):
    __tablename__ = "quiz_responses"

    id = Column(Integer, primary_key=True, index=True)
    quiz_session_id = Column(Integer, ForeignKey("quiz_sessions.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=False, index=True)
    
    user_answer = Column(Text, nullable=False)
    is_correct = Column(Boolean, nullable=False)
    score_awarded = Column(Float, default=0.0)
    feedback = Column(Text, nullable=True)
    feedback_citations = Column(JSON, default=list)
    misconception_tag = Column(String(255), nullable=True)
    
    response_time_sec = Column(Float, nullable=True)
    confidence_level = Column(String(50), nullable=True)
    submitted_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    quiz_session = relationship("QuizSession", back_populates="responses")
    question = relationship("Question", back_populates="responses")
