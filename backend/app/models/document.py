import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum, JSON
from sqlalchemy.orm import relationship
from backend.app.database import Base

class DocumentStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    INDEXED = "indexed"
    FAILED = "failed"

class SourceType(str, enum.Enum):
    PDF = "pdf"
    PPTX = "pptx"
    VIDEO = "video"
    AUDIO = "audio"
    IMAGE = "image"

class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False, index=True)
    uploaded_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    filename = Column(String(255), nullable=False)
    file_type = Column(Enum(SourceType), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size_bytes = Column(Integer, default=0)
    status = Column(Enum(DocumentStatus), default=DocumentStatus.PENDING, index=True)
    page_or_slide_count = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    extracted_metadata = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    course = relationship("Course", back_populates="documents")
    uploader = relationship("User", back_populates="documents")
    chunks = relationship("DocumentChunk", back_populates="document", cascade="all, delete-orphan")

class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False, index=True)
    topic_id = Column(Integer, ForeignKey("topics.id"), nullable=True, index=True)
    chunk_index = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    
    # Precise source grounding references
    page_number = Column(Integer, nullable=True)
    slide_number = Column(Integer, nullable=True)
    timestamp_start_sec = Column(Integer, nullable=True)
    timestamp_end_sec = Column(Integer, nullable=True)
    source_type = Column(Enum(SourceType), nullable=False)
    figure_description = Column(Text, nullable=True)
    
    # Stored dense vector representation (JSON serialized array of floats)
    embedding = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    document = relationship("Document", back_populates="chunks")
