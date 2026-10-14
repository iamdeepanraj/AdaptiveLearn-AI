import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum, Float, Boolean, JSON
from sqlalchemy.orm import relationship
from backend.app.database import Base


class MasteryState(str, enum.Enum):
    NOVICE = "novice"           # P(L) < 0.40
    LEARNING = "learning"       # 0.40 <= P(L) < 0.70
    PROFICIENT = "proficient"   # 0.70 <= P(L) < 0.85
    MASTERED = "mastered"       # P(L) >= 0.85

class RecommendationType(str, enum.Enum):
    REVIEW_WEAK = "review_weak"
    NEXT_PREREQUISITE = "next_prerequisite"
    SPACED_REPETITION = "spaced_repetition"
    PRACTICE_QUIZ = "practice_quiz"

class LearnerMastery(Base):
    __tablename__ = "learner_mastery"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    topic_id = Column(Integer, ForeignKey("topics.id"), nullable=False, index=True)
    
    # Bayesian Knowledge Tracing parameters
    p_mastery = Column(Float, default=0.20, nullable=False)   # Current P(L_t)
    p_transit = Column(Float, default=0.15, nullable=False)   # P(T)
    p_slip = Column(Float, default=0.10, nullable=False)      # P(S)
    p_guess = Column(Float, default=0.20, nullable=False)     # P(G)
    p_init = Column(Float, default=0.20, nullable=False)      # P(L_0)
    
    mastery_state = Column(Enum(MasteryState), default=MasteryState.NOVICE, nullable=False)
    
    # Engagement and attempt metrics
    total_attempts = Column(Integer, default=0)
    correct_attempts = Column(Integer, default=0)
    last_accuracy = Column(Float, default=0.0)
    
    # Understanding Level & Misconception Tracking
    understanding_score = Column(Float, default=0.0, nullable=False)
    understanding_level = Column(String(50), default="Not assessed", nullable=False)  # Strong, Developing, Weak, Not assessed
    misconception_counts = Column(JSON, default=dict)  # {"Misconception text": count}
    history_scores = Column(JSON, default=list)  # list of recent float scores

    # Spaced Repetition (Half-life / SuperMemo model)
    repetition_count = Column(Integer, default=0)
    interval_days = Column(Float, default=1.0)
    easiness_factor = Column(Float, default=2.5)
    last_practiced_at = Column(DateTime, nullable=True)
    next_review_due_at = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="learner_masteries")
    topic = relationship("Topic", back_populates="learner_masteries")

class RemediationSession(Base):
    __tablename__ = "remediation_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    topic_id = Column(Integer, ForeignKey("topics.id"), nullable=False, index=True)
    concept_name = Column(String(255), nullable=False)
    round_number = Column(Integer, default=1)
    explanation_style = Column(String(50), default="simpler")  # simpler, analogy, step_by_step, worked_example
    explanation_text = Column(Text, nullable=False)
    worked_example = Column(Text, nullable=True)
    misconception_addressed = Column(String(255), nullable=True)
    check_questions = Column(JSON, default=list)
    check_answers = Column(JSON, default=list)
    score = Column(Float, default=0.0)
    is_improving = Column(Boolean, default=False)
    status = Column(String(50), default="in_progress")  # in_progress, completed, max_rounds_reached
    suggested_readings = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="remediation_sessions")
    topic = relationship("Topic")

class MasteryHistory(Base):
    __tablename__ = "mastery_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    topic_id = Column(Integer, ForeignKey("topics.id"), nullable=False, index=True)
    quiz_session_id = Column(Integer, ForeignKey("quiz_sessions.id"), nullable=True)
    quiz_response_id = Column(Integer, ForeignKey("quiz_responses.id"), nullable=True)
    
    p_mastery_before = Column(Float, nullable=False)
    p_mastery_after = Column(Float, nullable=False)
    is_correct = Column(Boolean, nullable=False)
    action_type = Column(String(50), default="quiz_response")
    timestamp = Column(DateTime, default=datetime.utcnow)

class Recommendation(Base):
    __tablename__ = "recommendations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False, index=True)
    topic_id = Column(Integer, ForeignKey("topics.id"), nullable=False, index=True)
    
    recommendation_type = Column(Enum(RecommendationType), nullable=False)
    title = Column(String(255), nullable=False)
    reason = Column(Text, nullable=False)
    priority = Column(Integer, default=1)  # 1 (highest) to 5
    is_dismissed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="recommendations")

