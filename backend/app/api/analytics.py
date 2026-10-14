from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models.user import User
from backend.app.models.course import Course, Topic
from backend.app.models.learner import LearnerMastery, MasteryHistory, Recommendation, MasteryState
from backend.app.models.quiz import QuizSession, QuizResponse
from backend.app.schemas.analytics import StudentDashboardSummary, TopicMasterySummary, RecommendationCard, MasteryHistoryPoint
from backend.app.auth import get_current_user
from backend.app.learner_model.recommendation_engine import RecommendationEngine
from backend.app.learner_model.spaced_repetition import SpacedRepetitionScheduler

router = APIRouter(prefix="/analytics", tags=["Learning Analytics"])

@router.get("/student", response_model=StudentDashboardSummary)
def get_student_dashboard(
    course_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # If no course specified, use default course
    if not course_id:
        course = db.query(Course).first()
        course_id = course.id if course else 1

    # Generate fresh recommendations
    RecommendationEngine.generate_recommendations(db=db, user_id=current_user.id, course_id=course_id)

    # Fetch learner masteries
    masteries = db.query(LearnerMastery, Topic.name, Course.title)\
        .join(Topic, LearnerMastery.topic_id == Topic.id)\
        .join(Course, Topic.course_id == Course.id)\
        .filter(LearnerMastery.user_id == current_user.id)

    if course_id:
        masteries = masteries.filter(Topic.course_id == course_id)

    mastery_rows = masteries.all()

    weak_list = []
    strong_list = []
    revision_list = []
    total_mastery_sum = 0.0
    mastered_cnt = 0
    in_progress_cnt = 0

    for m, topic_name, c_title in mastery_rows:
        total_mastery_sum += m.p_mastery
        is_due = SpacedRepetitionScheduler.is_review_due(m.next_review_due_at)
        
        item = TopicMasterySummary(
            topic_id=m.topic_id,
            topic_name=topic_name,
            course_id=course_id,
            course_name=c_title,
            p_mastery=round(m.p_mastery, 3),
            mastery_state=m.mastery_state.value if hasattr(m.mastery_state, 'value') else str(m.mastery_state),
            total_attempts=m.total_attempts,
            correct_attempts=m.correct_attempts,
            accuracy=round((m.correct_attempts / max(1, m.total_attempts)) * 100, 1),
            next_review_due_at=m.next_review_due_at,
            is_due_for_review=is_due
        )

        if m.p_mastery >= 0.70:
            strong_list.append(item)
            mastered_cnt += 1
        elif m.total_attempts > 0 and m.p_mastery < 0.50:
            weak_list.append(item)
            in_progress_cnt += 1
        else:
            in_progress_cnt += 1

        if is_due:
            revision_list.append(item)

    avg_mastery = round(total_mastery_sum / max(1, len(mastery_rows)), 3) if mastery_rows else 0.20

    # Total questions answered
    total_responses = db.query(QuizResponse).filter(QuizResponse.user_id == current_user.id).count()
    correct_responses = db.query(QuizResponse).filter(
        QuizResponse.user_id == current_user.id,
        QuizResponse.is_correct == True
    ).count()
    overall_acc = round((correct_responses / max(1, total_responses)) * 100, 1)

    # Total sessions
    total_sessions = db.query(QuizSession).filter(QuizSession.user_id == current_user.id).count()

    # Active recommendations
    recs = db.query(Recommendation).filter(
        Recommendation.user_id == current_user.id,
        Recommendation.is_dismissed == False
    ).order_by(Recommendation.priority.asc()).limit(5).all()

    rec_cards = [
        RecommendationCard(
            id=r.id,
            topic_id=r.topic_id,
            topic_name=db.query(Topic.name).filter(Topic.id == r.topic_id).scalar() or "Topic",
            course_id=r.course_id,
            recommendation_type=r.recommendation_type.value if hasattr(r.recommendation_type, 'value') else str(r.recommendation_type),
            title=r.title,
            reason=r.reason,
            priority=r.priority
        ) for r in recs
    ]

    # Mastery Timeline
    history_rows = db.query(MasteryHistory, Topic.name)\
        .join(Topic, MasteryHistory.topic_id == Topic.id)\
        .filter(MasteryHistory.user_id == current_user.id)\
        .order_by(MasteryHistory.timestamp.asc()).limit(25).all()

    timeline = [
        MasteryHistoryPoint(
            timestamp=h.timestamp,
            p_mastery=round(h.p_mastery_after, 3),
            topic_name=t_name,
            is_correct=h.is_correct
        ) for h, t_name in history_rows
    ]

    return StudentDashboardSummary(
        overall_mastery=avg_mastery,
        topics_mastered_count=mastered_cnt,
        topics_in_progress_count=in_progress_cnt,
        total_study_sessions=total_sessions,
        total_questions_answered=total_responses,
        overall_accuracy=overall_acc,
        weak_topics=weak_list,
        strong_topics=strong_list,
        upcoming_revisions=revision_list,
        recommendations=rec_cards,
        mastery_timeline=timeline
    )

@router.get("/recommendations", response_model=List[RecommendationCard])
def get_recommendations(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    RecommendationEngine.generate_recommendations(db=db, user_id=current_user.id, course_id=course_id)
    recs = db.query(Recommendation).filter(
        Recommendation.user_id == current_user.id,
        Recommendation.course_id == course_id,
        Recommendation.is_dismissed == False
    ).order_by(Recommendation.priority.asc()).all()

    return [
        RecommendationCard(
            id=r.id,
            topic_id=r.topic_id,
            topic_name=db.query(Topic.name).filter(Topic.id == r.topic_id).scalar() or "Topic",
            course_id=r.course_id,
            recommendation_type=r.recommendation_type.value if hasattr(r.recommendation_type, 'value') else str(r.recommendation_type),
            title=r.title,
            reason=r.reason,
            priority=r.priority
        ) for r in recs
    ]
