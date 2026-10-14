import os
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models.user import User
from backend.app.models.document import Document, DocumentChunk
from backend.app.schemas.document import DocumentResponse, DocumentChunkResponse
from backend.app.auth import get_current_user
from backend.app.ingestion.pipeline import IngestionPipeline

router = APIRouter(prefix="/documents", tags=["Documents"])

@router.post("/upload", response_model=DocumentResponse)
def upload_document(
    file: UploadFile = File(...),
    course_id: int = Form(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify course ownership
    from backend.app.models.course import Course
    course = db.query(Course).filter(Course.id == course_id, Course.created_by_id == current_user.id).first()
    if not course:
        raise HTTPException(status_code=403, detail="You can only upload material to courses you own.")

    try:
        doc = IngestionPipeline.save_and_ingest(
            db=db,
            file=file,
            course_id=course_id,
            user_id=current_user.id
        )
        return doc
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    doc = db.query(Document).filter(Document.id == document_id, Document.uploader_id == current_user.id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found or access denied")

    # Optionally remove file from disk
    if doc.file_path and os.path.exists(doc.file_path):
        try:
            os.remove(doc.file_path)
        except OSError:
            pass

    db.delete(doc)
    db.commit()
    return None

@router.get("", response_model=List[DocumentResponse])
def get_course_documents(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from backend.app.models.course import Course
    course = db.query(Course).filter(Course.id == course_id, Course.created_by_id == current_user.id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found or access denied")

    docs = db.query(Document).filter(Document.course_id == course_id, Document.uploader_id == current_user.id).order_by(Document.created_at.desc()).all()
    return docs

@router.get("/{document_id}", response_model=DocumentResponse)
def get_document_detail(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc

@router.get("/{document_id}/chunks", response_model=List[DocumentChunkResponse])
def get_document_chunks(
    document_id: int,
    page: Optional[int] = None,
    slide: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(DocumentChunk).filter(DocumentChunk.document_id == document_id)
    if page:
        query = query.filter(DocumentChunk.page_number == page)
    if slide:
        query = query.filter(DocumentChunk.slide_number == slide)
    chunks = query.order_by(DocumentChunk.chunk_index).all()
    return chunks

@router.get("/{document_id}/preview")
def get_document_source_preview(
    document_id: int,
    page: Optional[int] = None,
    slide: Optional[int] = None,
    timestamp: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns exact preview context for the interactive Source Preview Drawer/Modal
    when a student clicks a citation in the tutor chat or assessment feedback.
    """
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Source document not found")

    query = db.query(DocumentChunk).filter(DocumentChunk.document_id == document_id)
    if page:
        query = query.filter(DocumentChunk.page_number == page)
    elif slide:
        query = query.filter(DocumentChunk.slide_number == slide)
    elif timestamp is not None:
        query = query.filter(
            DocumentChunk.timestamp_start_sec <= timestamp,
            DocumentChunk.timestamp_end_sec >= timestamp
        )

    matched_chunk = query.first()
    if not matched_chunk:
        # Fallback to any chunk from document
        matched_chunk = db.query(DocumentChunk).filter(DocumentChunk.document_id == document_id).first()

    return {
        "document_id": doc.id,
        "filename": doc.filename,
        "file_type": doc.file_type.value if hasattr(doc.file_type, 'value') else str(doc.file_type),
        "target_page": page,
        "target_slide": slide,
        "target_timestamp": timestamp,
        "total_units": doc.page_or_slide_count,
        "excerpt": matched_chunk.content if matched_chunk else "No preview content available.",
        "figure_description": matched_chunk.figure_description if matched_chunk else None
    }
