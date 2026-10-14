import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Enum, Boolean
from sqlalchemy.orm import relationship
from backend.app.database import Base

class UserRole(str, enum.Enum):
    STUDENT = "student"
    TEACHER = "teacher"
    ADMIN = "admin"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), default=UserRole.STUDENT, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    documents = relationship("Document", back_populates="uploader", cascade="all, delete-orphan")
    conversations = relationship("Conversation", back_populates="user", cascade="all, delete-orphan")
    quiz_sessions = relationship("QuizSession", back_populates="user", cascade="all, delete-orphan")
    learner_masteries = relationship("LearnerMastery", back_populates="user", cascade="all, delete-orphan")
    recommendations = relationship("Recommendation", back_populates="user", cascade="all, delete-orphan")
    remediation_sessions = relationship("RemediationSession", back_populates="user", cascade="all, delete-orphan")

