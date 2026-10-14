import pytest
from backend.app.services.remediation_service import RemediationService
from backend.app.models.learner import LearnerMastery, RemediationSession
from backend.app.models.course import Course, Topic
from backend.app.models.quiz import Question, QuestionType, DifficultyLevel
from backend.app.models.document import Document, DocumentChunk, SourceType, DocumentStatus
from backend.app.models.user import User, UserRole
from backend.app.database import Base
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()

    user = User(
        email="remediation_test@adaptivelearn.ai",
        hashed_password="pw",
        full_name="Remediation Student",
        role=UserRole.STUDENT
    )
    session.add(user)
    session.commit()

    course = Course(code="CS102", title="Deep Learning", created_by_id=user.id)
    session.add(course)
    session.commit()

    topic = Topic(course_id=course.id, name="Transformers", code="TRANS", order_index=1)
    session.add(topic)
    session.commit()

    # Document chunk
    doc = Document(
        course_id=course.id,
        uploaded_by_id=user.id,
        filename="lecture.pdf",
        file_type=SourceType.PDF,
        file_path="uploads/lecture.pdf",
        status=DocumentStatus.INDEXED
    )
    session.add(doc)
    session.commit()

    chunk = DocumentChunk(
        document_id=doc.id,
        course_id=course.id,
        topic_id=topic.id,
        chunk_index=0,
        content="Attention mechanisms allow dynamic weighted representations across token sequences.",
        page_number=1,
        source_type=SourceType.PDF
    )
    session.add(chunk)

    # Check question
    q = Question(
        course_id=course.id,
        topic_id=topic.id,
        question_type=QuestionType.MCQ,
        difficulty=DifficultyLevel.EASY,
        question_text="What do attention mechanisms compute across sequence tokens?",
        correct_answer="A",
        explanation="Attention computes dynamic weighted representations.",
        options=[
            {"key": "A", "text": "Dynamic weighted representations", "label": "correct", "score": 1.0, "rationale": "Correct"},
            {"key": "B", "text": "Static averages", "label": "partial", "score": 0.5, "rationale": "Averages but not dynamic", "misconception": "Believed attention weights are static"},
            {"key": "C", "text": "Disables backprop", "label": "wrong", "score": 0.0, "rationale": "Wrong", "misconception": "No backprop"},
            {"key": "D", "text": "Linear decay", "label": "wrong", "score": 0.0, "rationale": "Wrong", "misconception": "Decay"}
        ],
        fingerprint="fp_remed_1",
        source_citations=[{"document_id": doc.id, "page": 1, "quote": "dynamic weighted"}],
        is_verified=True
    )
    session.add(q)

    # Weak mastery
    mastery = LearnerMastery(
        user_id=user.id,
        topic_id=topic.id,
        understanding_score=0.40,
        understanding_level="Weak",
        misconception_counts={"Believed attention weights are static": 2},
        history_scores=[0.0, 0.5],
        total_attempts=2
    )
    session.add(mastery)
    session.commit()

    yield session
    session.close()

def test_remediation_starts_round_1(db_session):
    user = db_session.query(User).first()
    topic = db_session.query(Topic).first()

    session_data = RemediationService.start_or_get_session(
        db=db_session,
        user_id=user.id,
        topic_id=topic.id,
        round_number=1
    )
    assert session_data["round_number"] == 1
    assert session_data["explanation_style"] == "simpler"
    assert "Believed attention weights are static" in session_data["misconception_addressed"]
    assert len(session_data["check_questions"]) >= 1

def test_remediation_improving_marks_success(db_session):
    user = db_session.query(User).first()
    topic = db_session.query(Topic).first()
    q = db_session.query(Question).first()

    session_data = RemediationService.start_or_get_session(
        db=db_session,
        user_id=user.id,
        topic_id=topic.id,
        round_number=1
    )
    sid = session_data["session_id"]

    # Submit correct answer (score = 1.0 >= 0.8)
    res = RemediationService.submit_answers(
        db=db_session,
        user_id=user.id,
        session_id=sid,
        answers=[{"question_id": q.id, "answer": "A"}]
    )
    assert res["is_improving"] is True
    assert res["status"] == "completed_improving"

def test_remediation_low_score_advances_round(db_session):
    user = db_session.query(User).first()
    topic = db_session.query(Topic).first()
    q = db_session.query(Question).first()

    session_data = RemediationService.start_or_get_session(
        db=db_session,
        user_id=user.id,
        topic_id=topic.id,
        round_number=1
    )
    sid = session_data["session_id"]

    # Submit wrong answer (score = 0.0 < 0.8)
    res = RemediationService.submit_answers(
        db=db_session,
        user_id=user.id,
        session_id=sid,
        answers=[{"question_id": q.id, "answer": "C"}]
    )
    assert res["is_improving"] is False
    assert res["status"] == "needs_another_round"
    assert res["next_round"] == 2
    assert res["next_style"] == "analogy"
