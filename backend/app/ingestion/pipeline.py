import os
import shutil
import logging
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from fastapi import UploadFile, HTTPException

from backend.app.config import settings
from backend.app.models.document import Document, DocumentChunk, DocumentStatus, SourceType
from backend.app.models.course import Topic
from backend.app.ingestion.pdf_processor import PDFProcessor
from backend.app.ingestion.pptx_processor import PPTXProcessor
from backend.app.ingestion.media_processor import MediaProcessor
from backend.app.ingestion.chunker import SemanticChunker
from backend.app.retrieval.embeddings import embedding_service

logger = logging.getLogger(__name__)

class IngestionPipeline:
    @staticmethod
    def validate_file(file: UploadFile) -> str:
        """Validates extension and returns detected SourceType."""
        ext = file.filename.split(".")[-1].lower() if "." in file.filename else ""
        if ext not in settings.ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type '.{ext}'. Supported extensions: {', '.join(settings.ALLOWED_EXTENSIONS)}"
            )
        
        if ext == "pdf":
            return SourceType.PDF
        elif ext in ["pptx", "ppt"]:
            return SourceType.PPTX
        elif ext in ["mp4", "mov", "avi"]:
            return SourceType.VIDEO
        elif ext in ["mp3", "wav", "m4a"]:
            return SourceType.AUDIO
        elif ext in ["png", "jpg", "jpeg"]:
            return SourceType.IMAGE
        else:
            raise HTTPException(status_code=400, detail="Unsupported source category")

    @classmethod
    def save_and_ingest(
        cls,
        db: Session,
        file: UploadFile,
        course_id: int,
        user_id: int
    ) -> Document:
        """
        Saves file to storage, creates Document record, and runs extraction,
        chunking, embedding, and indexing synchronously so progress is accurate.
        """
        source_type = cls.validate_file(file)
        
        # Save to local disk
        os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
        safe_filename = f"{int(os.times().elapsed * 1000)}_{file.filename.replace(' ', '_')}"
        file_path = os.path.join(settings.UPLOAD_DIR, safe_filename)

        file_size = 0
        with open(file_path, "wb") as buffer:
            file_bytes = file.file.read()
            file_size = len(file_bytes)
            max_bytes = settings.MAX_FILE_SIZE_MB * 1024 * 1024
            if file_size > max_bytes:
                os.remove(file_path)
                raise HTTPException(
                    status_code=400,
                    detail=f"File exceeds maximum allowed size of {settings.MAX_FILE_SIZE_MB}MB."
                )
            buffer.write(file_bytes)

        # Create Document entry
        doc_record = Document(
            course_id=course_id,
            uploaded_by_id=user_id,
            filename=file.filename,
            file_type=source_type,
            file_path=file_path,
            file_size_bytes=file_size,
            status=DocumentStatus.PROCESSING
        )
        db.add(doc_record)
        db.commit()
        db.refresh(doc_record)

        try:
            # 1. Multimodal Extraction
            raw_units: List[Dict[str, Any]] = []
            page_or_slide_count = 0

            if source_type == SourceType.PDF:
                raw_units = PDFProcessor.process_pdf(file_path)
                page_or_slide_count = len(raw_units)
            elif source_type == SourceType.PPTX:
                raw_units = PPTXProcessor.process_pptx(file_path)
                page_or_slide_count = len(raw_units)
            elif source_type in [SourceType.VIDEO, SourceType.AUDIO]:
                raw_units = MediaProcessor.process_media(file_path)
                page_or_slide_count = len(raw_units)
            elif source_type == SourceType.IMAGE:
                # OCR extraction simulation / vision model metadata
                raw_units = [{
                    "page_number": 1,
                    "text": f"Extracted visual diagram and concept graph for: {file.filename}.",
                    "figures": [{"figure_id": "img_1", "description": f"Architectural chart: {file.filename}"}]
                }]
                page_or_slide_count = 1

            if not raw_units:
                raise ValueError("No extractable content found in document.")

            # 2. Semantic Chunking preserving exact source coordinates
            chunks_data = SemanticChunker.chunk_document_content(
                items=raw_units,
                source_type=source_type
            )

            # 3. Associate chunks with course topics based on keyword matching
            topics = db.query(Topic).filter(Topic.course_id == course_id).all()

            # 4. Generate Embeddings & Persist Chunks
            for chunk_dict in chunks_data:
                content = chunk_dict["content"]
                
                # Match topic if possible
                matched_topic_id = None
                for t in topics:
                    if t.name.lower() in content.lower():
                        matched_topic_id = t.id
                        break

                embedding = embedding_service.get_embedding(content)

                chunk_obj = DocumentChunk(
                    document_id=doc_record.id,
                    course_id=course_id,
                    topic_id=matched_topic_id,
                    chunk_index=chunk_dict["chunk_index"],
                    content=content,
                    page_number=chunk_dict["page_number"],
                    slide_number=chunk_dict["slide_number"],
                    timestamp_start_sec=chunk_dict["timestamp_start_sec"],
                    timestamp_end_sec=chunk_dict["timestamp_end_sec"],
                    source_type=chunk_dict["source_type"],
                    figure_description=chunk_dict["figure_description"],
                    embedding=embedding
                )
                db.add(chunk_obj)

            # Update document to INDEXED
            doc_record.status = DocumentStatus.INDEXED
            doc_record.page_or_slide_count = page_or_slide_count
            doc_record.extracted_metadata = {
                "total_chunks": len(chunks_data),
                "total_units": page_or_slide_count,
                "source_type": source_type.value
            }
            db.commit()
            db.refresh(doc_record)
            logger.info(f"Document {doc_record.id} successfully indexed with {len(chunks_data)} chunks.")

        except Exception as e:
            logger.error(f"Failed to ingest document {doc_record.id}: {e}", exc_info=True)
            db.rollback()
            doc_record.status = DocumentStatus.FAILED
            doc_record.error_message = str(e)
            db.commit()

        return doc_record
