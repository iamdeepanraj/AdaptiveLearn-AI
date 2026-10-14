import pytest
from backend.app.assessment.verifier import QuestionVerifier
from backend.app.assessment.grader import AssessmentGrader
from backend.app.models.quiz import Question, QuestionType, DifficultyLevel, QuizSession, QuizStatus
from backend.app.models.course import Course, Topic
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
        email="student_test@adaptivelearn.ai",
        hashed_password="pw",
        full_name="Student Test",
        role=UserRole.STUDENT
    )
    session.add(user)
    session.commit()

    course = Course(code="CS101", title="Machine Learning", created_by_id=user.id)
    session.add(course)
    session.commit()

    topic = Topic(course_id=course.id, name="Optimization", code="OPT", order_index=1)
    session.add(topic)
    session.commit()

    yield session
    session.close()

def test_graded_mcq_verifier_validates_4_options():
    # Exactly 4 options: 1 correct, 1 partial, 2 wrong
    valid_graded_q = {
        "question_type": "mcq",
        "question_text": "What happens if learning rate is excessively large?",
        "correct_answer": "A",
        "explanation": "Causes divergence.",
        "options": [
            {"key": "A", "text": "Diverges", "label": "correct", "score": 1.0, "rationale": "Overshoots minimum"},
            {"key": "B", "text": "Slow convergence", "label": "partial", "score": 0.5, "rationale": "Small rate causes slow convergence", "misconception": "Confused large with small"},
            {"key": "C", "text": "Weights zero out", "label": "wrong", "score": 0.0, "rationale": "L1 effect", "misconception": "Confused rate with L1 norm"},
            {"key": "D", "text": "One step convergence", "label": "wrong", "score": 0.0, "rationale": "Does not converge in one step", "misconception": "Believed higher rate always speeds up"}
        ],
        "source_citations": [{"document_id": 1, "page": 3, "quote": "diverges"}]
    }
    is_valid, reason = QuestionVerifier.verify_question(valid_graded_q)
    assert is_valid is True, reason

def test_graded_mcq_verifier_rejects_missing_partial():
    # Only 1 correct and 3 wrong (missing partial)
    invalid_graded_q = {
        "question_type": "mcq",
        "question_text": "What happens if learning rate is excessively large?",
        "correct_answer": "A",
        "explanation": "Causes divergence.",
        "options": [
            {"key": "A", "text": "Diverges", "label": "correct", "score": 1.0, "rationale": "Right"},
            {"key": "B", "text": "Option B", "label": "wrong", "score": 0.0, "rationale": "Wrong", "misconception": "Disc 1"},
            {"key": "C", "text": "Option C", "label": "wrong", "score": 0.0, "rationale": "Wrong", "misconception": "Disc 2"},
            {"key": "D", "text": "Option D", "label": "wrong", "score": 0.0, "rationale": "Wrong", "misconception": "Disc 3"}
        ],
        "source_citations": [{"document_id": 1, "page": 3, "quote": "diverges"}]
    }
    is_valid, reason = QuestionVerifier.verify_question(invalid_graded_q)
    assert is_valid is False
    assert "partial" in reason.lower()

def test_graded_mcq_scoring_and_feedback(db_session):
    user = db_session.query(User).first()
    topic = db_session.query(Topic).first()

    q = Question(
        course_id=topic.course_id,
        topic_id=topic.id,
        question_type=QuestionType.MCQ,
        difficulty=DifficultyLevel.MEDIUM,
        question_text="What happens when learning rate is excessively high?",
        correct_answer="A",
        explanation="Learning rate causes divergence.",
        options=[
            {"key": "A", "text": "Diverges", "label": "correct", "score": 1.0, "rationale": "Right", "misconception": None},
            {"key": "B", "text": "Slow convergence", "label": "partial", "score": 0.5, "rationale": "Small rate causes slow convergence", "misconception": "Confused large with small"},
            {"key": "C", "text": "Weights zero out", "label": "wrong", "score": 0.0, "rationale": "L1 effect", "misconception": "Confused rate with L1"},
            {"key": "D", "text": "Instant convergence", "label": "wrong", "score": 0.0, "rationale": "No instant convergence", "misconception": "Believed higher rate speeds up"}
        ],
        fingerprint="fp123456",
        source_citations=[{"document_id": 1, "page": 3, "quote": "diverges"}],
        is_verified=True
    )
    db_session.add(q)
    db_session.commit()

    quiz_sess = QuizSession(user_id=user.id, course_id=topic.course_id, status=QuizStatus.IN_PROGRESS)
    db_session.add(quiz_sess)
    db_session.commit()

    # 1. Correct option
    res_correct = AssessmentGrader.grade_answer(
        db=db_session,
        user_id=user.id,
        quiz_session_id=quiz_sess.id,
        question_id=q.id,
        user_answer="A"
    )
    assert res_correct.is_correct is True
    assert res_correct.score_awarded == 1.0
    assert res_correct.option_label == "correct"

    # 2. Partial option
    res_partial = AssessmentGrader.grade_answer(
        db=db_session,
        user_id=user.id,
        quiz_session_id=quiz_sess.id,
        question_id=q.id,
        user_answer="B"
    )
    assert res_partial.is_correct is False
    assert res_partial.score_awarded == 0.5
    assert res_partial.option_label == "partial"
    assert "missing a key detail" in res_partial.feedback.lower() or "partial" in res_partial.feedback.lower()

    # 3. Wrong option
    res_wrong = AssessmentGrader.grade_answer(
        db=db_session,
        user_id=user.id,
        quiz_session_id=quiz_sess.id,
        question_id=q.id,
        user_answer="C"
    )
    assert res_wrong.is_correct is False
    assert res_wrong.score_awarded == 0.0
    assert res_wrong.option_label == "wrong"
    assert "misconception" in res_wrong.feedback.lower()
