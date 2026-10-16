import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import datetime

from backend.app.database import Base
from backend.app.models.user import User, UserRole
from backend.app.models.course import Course, Topic
from backend.app.models.quiz import Question, QuestionType, DifficultyLevel, QuizSession, QuizResponse, QuizStatus
from backend.app.assessment.grader import AssessmentGrader

@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()

    user = User(email="section_test@adaptivelearn.ai", hashed_password="pw", full_name="Section Student", role=UserRole.STUDENT)
    session.add(user)
    session.commit()

    course = Course(code="CS201", title="Systems", created_by_id=user.id)
    session.add(course)
    session.commit()

    topic = Topic(course_id=course.id, name="Concurrency", code="CONC", order_index=1)
    session.add(topic)
    session.commit()

    # Questions across 3 sections
    # Section A: 2 MCQs
    q1 = Question(course_id=course.id, topic_id=topic.id, question_type=QuestionType.MCQ, difficulty=DifficultyLevel.EASY, question_text="MCQ 1", correct_answer="A", explanation="MCQ 1 explanation", fingerprint="fp_sec_1", options=[{"key": "A", "text": "Opt A", "label": "correct", "score": 1.0}])
    q2 = Question(course_id=course.id, topic_id=topic.id, question_type=QuestionType.MCQ, difficulty=DifficultyLevel.MEDIUM, question_text="MCQ 2", correct_answer="B", explanation="MCQ 2 explanation", fingerprint="fp_sec_2", options=[{"key": "B", "text": "Opt B", "label": "correct", "score": 1.0}])
    # Section B: 1 Short answer
    q3 = Question(course_id=course.id, topic_id=topic.id, question_type=QuestionType.SHORT_ANSWER, difficulty=DifficultyLevel.MEDIUM, question_text="Explain mutex locks", correct_answer="A mutual exclusion lock prevents concurrent access.", explanation="Mutex explanation", fingerprint="fp_sec_3")
    # Section C: 1 Numerical
    q4 = Question(course_id=course.id, topic_id=topic.id, question_type=QuestionType.NUMERICAL, difficulty=DifficultyLevel.EASY, question_text="Calculate speedup", correct_answer="4.0", explanation="Speedup explanation", fingerprint="fp_sec_4", numerical_tolerance=0.02)
    session.add_all([q1, q2, q3, q4])
    session.commit()

    quiz_session = QuizSession(
        user_id=user.id,
        course_id=course.id,
        title="Comprehensive Multi-Section Drill",
        status=QuizStatus.IN_PROGRESS,
        total_questions=4
    )
    session.add(quiz_session)
    session.commit()

    # Add responses
    # q1 correct (1.0)
    r1 = QuizResponse(quiz_session_id=quiz_session.id, user_id=user.id, question_id=q1.id, user_answer="A", is_correct=True, score_awarded=1.0)
    # q2 wrong (0.0)
    r2 = QuizResponse(quiz_session_id=quiz_session.id, user_id=user.id, question_id=q2.id, user_answer="C", is_correct=False, score_awarded=0.0)
    # q3 partial (0.5)
    r3 = QuizResponse(quiz_session_id=quiz_session.id, user_id=user.id, question_id=q3.id, user_answer="locks access", is_correct=False, score_awarded=0.5)
    # q4 correct (1.0)
    r4 = QuizResponse(quiz_session_id=quiz_session.id, user_id=user.id, question_id=q4.id, user_answer="4.0", is_correct=True, score_awarded=1.0)
    session.add_all([r1, r2, r3, r4])
    session.commit()

    return session, quiz_session.id

def test_separate_section_scores_generated(db_session):
    db, session_id = db_session
    report = AssessmentGrader.generate_assessment_report(db, session_id)

    assert report.total_questions == 4
    # Section scores should contain 3 sections: A, B, and C
    sec_map = {s.section_code: s for s in report.section_scores}
    assert "A" in sec_map, "Section A (MCQ) must be present"
    assert "B" in sec_map, "Section B (Short Answer) must be present"
    assert "C" in sec_map, "Section C (Numerical) must be present"

    # Verify Section A: 2 questions, 1.0 total score (50%)
    sec_a = sec_map["A"]
    assert sec_a.section_name == "Section A: Multiple choice"
    assert sec_a.questions_count == 2
    assert sec_a.total_score == 1.0
    assert sec_a.max_score == 2.0
    assert sec_a.accuracy_percentage == 50.0

    # Verify Section B: 1 question, 0.5 score (50%)
    sec_b = sec_map["B"]
    assert sec_b.section_name == "Section B: Short answers"
    assert sec_b.questions_count == 1
    assert sec_b.total_score == 0.5
    assert sec_b.max_score == 1.0
    assert sec_b.accuracy_percentage == 50.0

    # Verify Section C: 1 question, 1.0 score (100%)
    sec_c = sec_map["C"]
    assert sec_c.section_name == "Section C: Numerical problems"
    assert sec_c.questions_count == 1
    assert sec_c.total_score == 1.0
    assert sec_c.max_score == 1.0
    assert sec_c.accuracy_percentage == 100.0
