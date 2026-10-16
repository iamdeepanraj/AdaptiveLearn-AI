import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from backend.app.main import app
from backend.app.database import SessionLocal
from backend.app.models.user import User
from backend.app.models.course import Course
from backend.app.models.document import Document, DocumentChunk, DocumentStatus, SourceType
from backend.app.ingestion.media_processor import MediaProcessor

client = TestClient(app)

def get_auth_token():
    login_resp = client.post("/api/auth/login", json={
        "email": "student@adaptivelearn.ai",
        "password": "StudentPass123!"
    })
    return login_resp.json()["access_token"]

def test_pending_or_processing_document_guard():
    """Verify that documents in PENDING or PROCESSING status return the still-processing guard message and no citations."""
    token = get_auth_token()
    headers = {"Authorization": f"Bearer {token}"}

    db: Session = SessionLocal()
    try:
        course = db.query(Course).first()

        # Create a document in PROCESSING status
        doc_proc = Document(
            course_id=course.id,
            filename="lecture_transcript.vtt",
            file_type=SourceType.VIDEO,
            file_path="/tmp/lecture_transcript.vtt",
            status=DocumentStatus.PROCESSING
        )
        db.add(doc_proc)
        db.commit()
        db.refresh(doc_proc)

        # Send chat message requesting answer from this processing document
        resp = client.post("/api/chat", headers=headers, json={
            "course_id": course.id,
            "message": "What did the professor say in this video?",
            "prioritized_document_id": doc_proc.id
        })
        assert resp.status_code == 200
        data = resp.json()

        assert "Still Processing" in data["content"]
        assert "lecture_transcript.vtt" in data["content"]
        assert "not cite it yet" in data["content"].lower() or "wait" in data["content"].lower()
        assert len(data["citations"]) == 0
        assert data["model_badge"] == "system · indexing"

        # Cleanup
        db.delete(doc_proc)
        db.commit()
    finally:
        db.close()

def test_prioritized_document_retrieval_cites_first():
    """Verify that indexed document passed as prioritized_document_id has its chunks cited first."""
    token = get_auth_token()
    headers = {"Authorization": f"Bearer {token}"}

    db: Session = SessionLocal()
    try:
        course = db.query(Course).first()

        # Create an INDEXED document with a chunk
        doc = Document(
            course_id=course.id,
            filename="targeted_supplementary_notes.pdf",
            file_type=SourceType.PDF,
            file_path="/tmp/targeted_supplementary_notes.pdf",
            status=DocumentStatus.INDEXED
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)

        content_str = "Hypergradient optimization computes exact gradients with respect to hyperparameters using the implicit function theorem."
        from backend.app.retrieval.embeddings import embedding_service
        chunk = DocumentChunk(
            document_id=doc.id,
            course_id=course.id,
            content=content_str,
            chunk_index=0,
            page_number=42,
            source_type=SourceType.PDF,
            embedding=embedding_service.get_embedding(content_str)
        )
        db.add(chunk)
        db.commit()
        db.refresh(chunk)

        # Query asking specifically about hypergradients with prioritized_document_id
        resp = client.post("/api/chat", headers=headers, json={
            "course_id": course.id,
            "message": "What computes exact gradients with respect to hyperparameters?",
            "prioritized_document_id": doc.id
        })
        assert resp.status_code == 200
        data = resp.json()

        assert len(data["citations"]) >= 1
        # The first citation should be from the prioritized document
        first_cite = data["citations"][0]
        assert first_cite["document_name"] == "targeted_supplementary_notes.pdf"
        assert first_cite["page"] == 42 or first_cite["chunk_id"] == chunk.id

        # Cleanup
        db.delete(chunk)
        db.delete(doc)
        db.commit()
    finally:
        db.close()

def test_vtt_srt_transcript_parsing_with_timestamps(tmp_path):
    """Verify that MediaProcessor properly parses .vtt and .srt subtitle files with start timestamps."""
    # 1. Test WebVTT parsing
    vtt_content = """WEBVTT

00:00:01.000 --> 00:00:05.500
Welcome to Machine Learning. Today we discuss gradient descent.

00:00:06.000 --> 00:00:12.000
The learning rate alpha determines the step size taken along the negative gradient.
"""
    vtt_file = tmp_path / "lecture.vtt"
    vtt_file.write_text(vtt_content)

    vtt_chunks = MediaProcessor.process_media(str(vtt_file))
    assert len(vtt_chunks) == 2
    assert vtt_chunks[0]["timestamp_start_sec"] == 1
    assert "gradient descent" in vtt_chunks[0]["text"]
    assert vtt_chunks[1]["timestamp_start_sec"] == 6
    assert "learning rate alpha" in vtt_chunks[1]["text"]

    # 2. Test SRT parsing
    srt_content = """1
00:01:10,000 --> 00:01:15,000
Backpropagation applies the chain rule backward from the loss function.

2
00:01:16,000 --> 00:01:22,000
Each weight update is proportional to the partial derivative of error.
"""
    srt_file = tmp_path / "lecture.srt"
    srt_file.write_text(srt_content)

    srt_chunks = MediaProcessor.process_media(str(srt_file))
    assert len(srt_chunks) == 2
    assert srt_chunks[0]["timestamp_start_sec"] == 70
    assert "chain rule" in srt_chunks[0]["text"]
    assert srt_chunks[1]["timestamp_start_sec"] == 76
