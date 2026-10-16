import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.app.database import Base
from backend.app.models.user import User, UserRole
from backend.app.models.course import Course, Topic
from backend.app.models.quiz import Question, QuestionType, DifficultyLevel, QuizSession, QuizResponse, QuizStatus
from backend.app.assessment.grader import AssessmentGrader

@pytest.fixture
def test_setup():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    db = Session()

    user = User(email="diag_student@adaptivelearn.ai", hashed_password="pw", full_name="Diagnostic Student", role=UserRole.STUDENT)
    db.add(user)
    db.commit()

    course = Course(code="CS301", title="Machine Learning", created_by_id=user.id)
    db.add(course)
    db.commit()

    topic = Topic(course_id=course.id, name="Optimization", code="OPT", order_index=1)
    db.add(topic)
    db.commit()

    return db, user, course, topic

def test_minimum_answers_rule(test_setup):
    """Verify that fewer than 3 answered questions in either section suppresses diagnostic comparison."""
    db, user, course, topic = test_setup

    q_mcq = Question(course_id=course.id, topic_id=topic.id, question_type=QuestionType.MCQ, difficulty=DifficultyLevel.EASY, question_text="Q MCQ", correct_answer="A", explanation="MCQ exp", fingerprint="fp_min_mcq", options=[{"key": "A", "text": "A", "label": "correct", "score": 1.0}])
    q_sa = Question(course_id=course.id, topic_id=topic.id, question_type=QuestionType.SHORT_ANSWER, difficulty=DifficultyLevel.EASY, question_text="Q SA", correct_answer="gradient descent minimizes loss", explanation="SA exp", fingerprint="fp_min_sa")
    db.add_all([q_mcq, q_sa])
    db.commit()

    quiz_session = QuizSession(user_id=user.id, course_id=course.id, title="Short Quiz", status=QuizStatus.IN_PROGRESS, total_questions=2)
    db.add(quiz_session)
    db.commit()

    r1 = QuizResponse(quiz_session_id=quiz_session.id, user_id=user.id, question_id=q_mcq.id, user_answer="A", is_correct=True, score_awarded=1.0)
    r2 = QuizResponse(quiz_session_id=quiz_session.id, user_id=user.id, question_id=q_sa.id, user_answer="minimizes loss", is_correct=False, score_awarded=0.4)
    db.add_all([r1, r2])
    db.commit()

    report = AssessmentGrader.generate_assessment_report(db, quiz_session.id)
    assert report.performance_comparison is not None
    assert report.performance_comparison.has_comparison is False
    assert "at least 3 answered questions" in (report.performance_comparison.reason or "").lower()

def test_case_1_mcq_good_written_weak(test_setup):
    """Case 1: MCQ >= 0.7, Short Answer < 0.5 -> How to improve your written answers."""
    db, user, course, topic = test_setup

    # 3 MCQs (all correct -> 1.0 >= 0.7)
    mcqs = [
        Question(course_id=course.id, topic_id=topic.id, question_type=QuestionType.MCQ, difficulty=DifficultyLevel.MEDIUM, question_text=f"MCQ {i}", correct_answer="A", explanation=f"MCQ {i} exp", fingerprint=f"fp_c1_mcq_{i}", options=[{"key": "A", "text": "Correct", "label": "correct", "score": 1.0}])
        for i in range(3)
    ]
    # 3 Short Answers (scores 0.2, 0.3, 0.4 -> avg 0.3 < 0.5)
    sas = [
        Question(
            course_id=course.id,
            topic_id=topic.id,
            question_type=QuestionType.SHORT_ANSWER,
            difficulty=DifficultyLevel.MEDIUM,
            question_text=f"Explain principle {i}",
            correct_answer=f"Gradient descent uses learning rate and backpropagation to optimize weights.",
            explanation=f"Principle {i} explanation",
            fingerprint=f"fp_c1_sa_{i}",
            options=[
                {"keyword": "learning rate", "weight": 1.0},
                {"keyword": "backpropagation", "weight": 1.0},
                {"keyword": "weights", "weight": 1.0}
            ]
        )
        for i in range(3)
    ]
    db.add_all(mcqs + sas)
    db.commit()

    quiz_session = QuizSession(user_id=user.id, course_id=course.id, title="Case 1 Quiz", status=QuizStatus.IN_PROGRESS, total_questions=6)
    db.add(quiz_session)
    db.commit()

    resps = []
    for q in mcqs:
        resps.append(QuizResponse(quiz_session_id=quiz_session.id, user_id=user.id, question_id=q.id, user_answer="A", is_correct=True, score_awarded=1.0))
    for q in sas:
        resps.append(QuizResponse(quiz_session_id=quiz_session.id, user_id=user.id, question_id=q.id, user_answer="it optimizes things", is_correct=False, score_awarded=0.3))
    db.add_all(resps)
    db.commit()

    report = AssessmentGrader.generate_assessment_report(db, quiz_session.id)
    comp = report.performance_comparison
    assert comp is not None
    assert comp.has_comparison is True
    assert comp.diagnosis_category == "mcq_good_written_weak"
    assert "How to improve your written answers" in comp.title
    assert "recognize the right answer" in comp.diagnosis.lower()
    assert len(comp.suggestions) >= 3
    assert comp.suggested_structure is not None
    assert len(comp.side_by_side_answers) >= 1
    assert comp.practice_set_type == "short_answer"

def test_case_2_written_good_mcq_weak(test_setup):
    """Case 2: Short Answer >= 0.7, MCQ < 0.5 -> How to improve on multiple choice."""
    db, user, course, topic = test_setup

    # 3 MCQs (all partial options -> score 0.5 or 0.0 -> avg < 0.5)
    mcqs = [
        Question(
            course_id=course.id,
            topic_id=topic.id,
            question_type=QuestionType.MCQ,
            difficulty=DifficultyLevel.MEDIUM,
            question_text=f"MCQ Distractor Trap {i}",
            correct_answer="A",
            explanation=f"Trap {i} explanation",
            fingerprint=f"fp_c2_mcq_{i}",
            options=[
                {"key": "A", "text": "Complete exact definition", "label": "correct", "score": 1.0},
                {"key": "B", "text": "Partial definition missing boundary", "label": "partial", "score": 0.5, "missing_detail": "Missing convergence rate bounds"}
            ]
        )
        for i in range(3)
    ]
    # 3 Short Answers (scores 0.9, 0.85, 0.9 -> avg > 0.7)
    sas = [
        Question(course_id=course.id, topic_id=topic.id, question_type=QuestionType.SHORT_ANSWER, difficulty=DifficultyLevel.MEDIUM, question_text=f"Explain {i}", correct_answer="Full technical model answer.", explanation=f"Explain {i} exp", fingerprint=f"fp_c2_sa_{i}")
        for i in range(3)
    ]
    db.add_all(mcqs + sas)
    db.commit()

    quiz_session = QuizSession(user_id=user.id, course_id=course.id, title="Case 2 Quiz", status=QuizStatus.IN_PROGRESS, total_questions=6)
    db.add(quiz_session)
    db.commit()

    resps = []
    for q in mcqs:
        resps.append(QuizResponse(quiz_session_id=quiz_session.id, user_id=user.id, question_id=q.id, user_answer="B", is_correct=False, score_awarded=0.4))
    for q in sas:
        resps.append(QuizResponse(quiz_session_id=quiz_session.id, user_id=user.id, question_id=q.id, user_answer="Comprehensive explanation matching model answer.", is_correct=True, score_awarded=0.9))
    db.add_all(resps)
    db.commit()

    report = AssessmentGrader.generate_assessment_report(db, quiz_session.id)
    comp = report.performance_comparison
    assert comp is not None
    assert comp.has_comparison is True
    assert comp.diagnosis_category == "written_good_mcq_weak"
    assert "How to improve on multiple choice" in comp.title
    assert "close distractors" in comp.diagnosis.lower()
    assert len(comp.partial_picks_comparison) >= 1
    assert comp.practice_set_type == "mcq"

def test_case_3_both_weak(test_setup):
    """Case 3: MCQ < 0.5 and Short Answer < 0.5 -> Learn this again."""
    db, user, course, topic = test_setup

    mcqs = [Question(course_id=course.id, topic_id=topic.id, question_type=QuestionType.MCQ, difficulty=DifficultyLevel.EASY, question_text=f"M {i}", correct_answer="A", explanation=f"M {i} exp", fingerprint=f"fp_c3_mcq_{i}") for i in range(3)]
    sas = [Question(course_id=course.id, topic_id=topic.id, question_type=QuestionType.SHORT_ANSWER, difficulty=DifficultyLevel.EASY, question_text=f"S {i}", correct_answer="Ans", explanation=f"S {i} exp", fingerprint=f"fp_c3_sa_{i}") for i in range(3)]
    db.add_all(mcqs + sas)
    db.commit()

    quiz_session = QuizSession(user_id=user.id, course_id=course.id, title="Both Weak Quiz", status=QuizStatus.IN_PROGRESS, total_questions=6)
    db.add(quiz_session)
    db.commit()

    resps = []
    for q in mcqs:
        resps.append(QuizResponse(quiz_session_id=quiz_session.id, user_id=user.id, question_id=q.id, user_answer="X", is_correct=False, score_awarded=0.2))
    for q in sas:
        resps.append(QuizResponse(quiz_session_id=quiz_session.id, user_id=user.id, question_id=q.id, user_answer="wrong", is_correct=False, score_awarded=0.2))
    db.add_all(resps)
    db.commit()

    report = AssessmentGrader.generate_assessment_report(db, quiz_session.id)
    comp = report.performance_comparison
    assert comp is not None
    assert comp.has_comparison is True
    assert comp.diagnosis_category == "both_weak"
    assert "Learn this again" in comp.title

def test_case_4_both_good(test_setup):
    """Case 4: MCQ >= 0.7 and Short Answer >= 0.7 -> Suggest harder questions."""
    db, user, course, topic = test_setup

    mcqs = [Question(course_id=course.id, topic_id=topic.id, question_type=QuestionType.MCQ, difficulty=DifficultyLevel.EASY, question_text=f"M {i}", correct_answer="A", explanation=f"M {i} exp", fingerprint=f"fp_c4_mcq_{i}") for i in range(3)]
    sas = [Question(course_id=course.id, topic_id=topic.id, question_type=QuestionType.SHORT_ANSWER, difficulty=DifficultyLevel.EASY, question_text=f"S {i}", correct_answer="Ans", explanation=f"S {i} exp", fingerprint=f"fp_c4_sa_{i}") for i in range(3)]
    db.add_all(mcqs + sas)
    db.commit()

    quiz_session = QuizSession(user_id=user.id, course_id=course.id, title="Both Good Quiz", status=QuizStatus.IN_PROGRESS, total_questions=6)
    db.add(quiz_session)
    db.commit()

    resps = []
    for q in mcqs:
        resps.append(QuizResponse(quiz_session_id=quiz_session.id, user_id=user.id, question_id=q.id, user_answer="A", is_correct=True, score_awarded=0.95))
    for q in sas:
        resps.append(QuizResponse(quiz_session_id=quiz_session.id, user_id=user.id, question_id=q.id, user_answer="Ans", is_correct=True, score_awarded=0.90))
    db.add_all(resps)
    db.commit()

    report = AssessmentGrader.generate_assessment_report(db, quiz_session.id)
    comp = report.performance_comparison
    assert comp is not None
    assert comp.has_comparison is True
    assert comp.diagnosis_category == "both_good"
    assert "harder" in comp.suggestions[1].lower() or "rigorous" in comp.suggestions[1].lower()
