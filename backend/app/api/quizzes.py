from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models.user import User
from backend.app.models.course import Course, Topic
from backend.app.models.quiz import QuizSession, QuizResponse, Question, QuizStatus
from backend.app.models.learner import LearnerMastery
from backend.app.schemas.quiz import (
    QuizStartRequest, QuizSessionResponse, QuestionStudentView, QuestionOption,
    AnswerSubmitRequest, QuizResponseResult, AssessmentReport
)
from backend.app.auth import get_current_user
from backend.app.assessment.generator import QuestionGenerator
from backend.app.assessment.grader import AssessmentGrader

router = APIRouter(prefix="/quizzes", tags=["Adaptive Assessments"])

@router.post("/start", response_model=QuizSessionResponse)
def start_quiz(
    req: QuizStartRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    course = db.query(Course).filter(Course.id == req.course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    # Determine average student mastery across requested topics to calibrate initial difficulty
    topics_query = db.query(LearnerMastery.p_mastery).filter(
        LearnerMastery.user_id == current_user.id
    )
    if req.topic_ids:
        topics_query = topics_query.filter(LearnerMastery.topic_id.in_(req.topic_ids))
    mastery_scores = [row[0] for row in topics_query.all()]
    avg_mastery = sum(mastery_scores) / len(mastery_scores) if mastery_scores else 0.40

    # Retrieve non-repeating questions adaptively
    questions = QuestionGenerator.get_adaptive_questions_for_student(
        db=db,
        user_id=current_user.id,
        course_id=req.course_id,
        topic_ids=req.topic_ids,
        question_types=req.question_types,
        difficulty_mode=req.difficulty_mode,
        target_count=req.question_count,
        target_mastery=avg_mastery
    )

    if not questions:
        raise HTTPException(status_code=400, detail="No suitable questions available for the selected topics.")

    # Create Quiz Session
    session_title = f"{course.code} Diagnostic Assessment" if req.is_diagnostic else f"{course.code} Adaptive Quiz"
    session = QuizSession(
        user_id=current_user.id,
        course_id=req.course_id,
        title=session_title,
        status=QuizStatus.IN_PROGRESS,
        target_topics=req.topic_ids or [],
        difficulty_mode=req.difficulty_mode,
        total_questions=len(questions),
        is_diagnostic=req.is_diagnostic
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    # Format student-safe question views (answers and solutions STRICTLY excluded!)
    student_questions = [QuestionGenerator.format_student_safe_question(q) for q in questions]


    return QuizSessionResponse(
        id=session.id,
        course_id=session.course_id,
        title=session.title,
        status=session.status.value if hasattr(session.status, 'value') else str(session.status),
        difficulty_mode=session.difficulty_mode,
        total_questions=session.total_questions,
        is_diagnostic=session.is_diagnostic,
        started_at=session.started_at,
        questions=student_questions
    )

@router.post("/submit", response_model=QuizResponseResult)
def submit_quiz_answer(
    submission: AnswerSubmitRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    session = db.query(QuizSession).filter(
        QuizSession.id == submission.quiz_session_id,
        QuizSession.user_id == current_user.id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Active quiz session not found.")

    try:
        result = AssessmentGrader.grade_answer(
            db=db,
            user_id=current_user.id,
            quiz_session_id=submission.quiz_session_id,
            question_id=submission.question_id,
            user_answer=submission.answer,
            response_time_sec=submission.response_time_sec,
            confidence_level=submission.confidence_level
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{session_id}/finish", response_model=AssessmentReport)
def finalize_quiz(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    session = db.query(QuizSession).filter(
        QuizSession.id == session_id,
        QuizSession.user_id == current_user.id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Quiz session not found.")

    try:
        report = AssessmentGrader.generate_assessment_report(db=db, quiz_session_id=session_id)
        return report
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{session_id}/report", response_model=AssessmentReport)
def get_assessment_report(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    session = db.query(QuizSession).filter(
        QuizSession.id == session_id,
        QuizSession.user_id == current_user.id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Quiz session not found.")

    if session.assessment_report:
        return AssessmentReport(**session.assessment_report)

    # If not yet generated, generate now
    return AssessmentGrader.generate_assessment_report(db=db, quiz_session_id=session_id)
