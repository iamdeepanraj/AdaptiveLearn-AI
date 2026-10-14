from typing import List, Dict, Any, Optional
from datetime import datetime
from sqlalchemy.orm import Session
import logging

from backend.app.models.learner import LearnerMastery, Recommendation, RecommendationType, MasteryState
from backend.app.models.course import Course, Topic, Prerequisite
from backend.app.learner_model.spaced_repetition import SpacedRepetitionScheduler

logger = logging.getLogger(__name__)

class RecommendationEngine:
    @staticmethod
    def generate_recommendations(db: Session, user_id: int, course_id: int) -> List[Recommendation]:
        """
        Analyzes student mastery, prerequisites, and spaced-repetition schedules
        to produce personalized, pedagogically prioritized recommendations.
        """
        # Fetch course topics
        topics = db.query(Topic).filter(Topic.course_id == course_id).order_by(Topic.order_index).all()
        if not topics:
            return []

        # Fetch current student masteries for these topics
        masteries = db.query(LearnerMastery).filter(
            LearnerMastery.user_id == user_id,
            LearnerMastery.topic_id.in_([t.id for t in topics])
        ).all()
        mastery_map = {m.topic_id: m for m in masteries}

        # Clear old non-dismissed recommendations for this course
        db.query(Recommendation).filter(
            Recommendation.user_id == user_id,
            Recommendation.course_id == course_id,
            Recommendation.is_dismissed == False
        ).delete()

        recommendations = []

        # 1. Diagnostic Recommendation if zero attempts
        total_attempts = sum([m.total_attempts for m in masteries])
        if total_attempts == 0:
            rec = Recommendation(
                user_id=user_id,
                course_id=course_id,
                topic_id=topics[0].id,
                recommendation_type=RecommendationType.PRACTICE_QUIZ,
                title="Take Initial Diagnostic Assessment",
                reason="Establish your baseline knowledge profile across all course modules so we can adapt content to your needs.",
                priority=1
            )
            db.add(rec)
            recommendations.append(rec)
            db.commit()
            return recommendations

        # 2. Spaced Repetition Due Reviews
        for topic in topics:
            m = mastery_map.get(topic.id)
            if m and SpacedRepetitionScheduler.is_review_due(m.next_review_due_at):
                rec = Recommendation(
                    user_id=user_id,
                    course_id=course_id,
                    topic_id=topic.id,
                    recommendation_type=RecommendationType.SPACED_REPETITION,
                    title=f"Spaced Review Due: {topic.name}",
                    reason=f"It has been several days since you practiced this topic. A quick review now will solidify your memory retention.",
                    priority=2
                )
                db.add(rec)
                recommendations.append(rec)

        # 3. Weak Topic Remediation (P(L) < 0.45 and attempted)
        for topic in topics:
            m = mastery_map.get(topic.id)
            if m and m.total_attempts > 0 and m.p_mastery < 0.45:
                rec = Recommendation(
                    user_id=user_id,
                    course_id=course_id,
                    topic_id=topic.id,
                    recommendation_type=RecommendationType.REVIEW_WEAK,
                    title=f"Targeted Practice: {topic.name}",
                    reason=f"Estimated mastery is {int(m.p_mastery * 100)}%. Reviewing source citations and taking a focused 3-question drill will boost your score.",
                    priority=1
                )
                db.add(rec)
                recommendations.append(rec)

        # 4. Next Prerequisite-Ready Topic
        for topic in topics:
            m = mastery_map.get(topic.id)
            # If not yet mastered
            if not m or m.p_mastery < 0.70:
                # Check prerequisites
                prereqs = db.query(Prerequisite).filter(Prerequisite.topic_id == topic.id).all()
                all_prereqs_met = True
                missing_prereqs = []
                for p in prereqs:
                    pm = mastery_map.get(p.prerequisite_topic_id)
                    if not pm or pm.p_mastery < 0.60:
                        all_prereqs_met = False
                        missing_prereqs.append(p.prerequisite_topic.name if p.prerequisite_topic else "Prerequisite")

                if all_prereqs_met and (not m or m.total_attempts == 0):
                    rec = Recommendation(
                        user_id=user_id,
                        course_id=course_id,
                        topic_id=topic.id,
                        recommendation_type=RecommendationType.NEXT_PREREQUISITE,
                        title=f"Ready to Learn: {topic.name}",
                        reason="All prerequisite topics are satisfied. You have the theoretical grounding ready to master this concept.",
                        priority=3
                    )
                    db.add(rec)
                    recommendations.append(rec)
                    break  # Suggest one next unlock at a time

        db.commit()
        for r in recommendations:
            db.refresh(r)
        return recommendations
