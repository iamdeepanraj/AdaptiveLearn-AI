from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Float
from sqlalchemy.orm import relationship
from backend.app.database import Base

class Course(Base):
    __tablename__ = "courses"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, index=True, nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    topics = relationship("Topic", back_populates="course", cascade="all, delete-orphan", order_by="Topic.order_index")
    documents = relationship("Document", back_populates="course", cascade="all, delete-orphan")
    questions = relationship("Question", back_populates="course", cascade="all, delete-orphan")
    conversations = relationship("Conversation", back_populates="course", cascade="all, delete-orphan")

class Topic(Base):
    __tablename__ = "topics"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    code = Column(String(50), nullable=True)
    description = Column(Text, nullable=True)
    order_index = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    course = relationship("Course", back_populates="topics")
    questions = relationship("Question", back_populates="topic", cascade="all, delete-orphan")
    learner_masteries = relationship("LearnerMastery", back_populates="topic", cascade="all, delete-orphan")
    
    # Prerequisites relationships
    prerequisites = relationship(
        "Prerequisite",
        foreign_keys="Prerequisite.topic_id",
        back_populates="topic",
        cascade="all, delete-orphan"
    )
    prerequisite_for = relationship(
        "Prerequisite",
        foreign_keys="Prerequisite.prerequisite_topic_id",
        back_populates="prerequisite_topic",
        cascade="all, delete-orphan"
    )

class Prerequisite(Base):
    __tablename__ = "prerequisites"

    id = Column(Integer, primary_key=True, index=True)
    topic_id = Column(Integer, ForeignKey("topics.id"), nullable=False, index=True)
    prerequisite_topic_id = Column(Integer, ForeignKey("topics.id"), nullable=False, index=True)

    # Relationships
    topic = relationship("Topic", foreign_keys=[topic_id], back_populates="prerequisites")
    prerequisite_topic = relationship("Topic", foreign_keys=[prerequisite_topic_id], back_populates="prerequisite_for")
