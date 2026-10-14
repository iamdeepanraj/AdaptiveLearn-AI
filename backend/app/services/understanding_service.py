from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
import logging

from backend.app.models.learner import LearnerMastery, RemediationSession
from backend.app.models.course import Topic, Course
from backend.app.models.quiz import QuizResponse, Question
from backend.app.learner.bkt import get_understanding_level, UNDERSTANDING_STRONG, UNDERSTANDING_DEVELOPING, UNDERSTANDING_WEAK, UNDERSTANDING_NOT_ASSESSED
from backend.app.ai import get_llm

logger = logging.getLogger(__name__)

class UnderstandingService:
    @classmethod
    def get_understanding_overview(
        cls,
        db: Session,
        user_id: int,
        course_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Gathers comprehensive understanding metrics strictly derived from stored results.
        Returns:
            - overall_level: 'Strong', 'Developing', 'Weak', or 'Not assessed'
            - overall_score: average understanding score across topics
            - topics: list of topic breakdowns with levels, scores, attempts, and trends
            - weak_concepts: top 3 weak concepts with misconceptions, evidence, and citations
            - strengths: list of mastered/strong concepts
            - plain_summary: concise model summary from stored numbers only
            - remediation_progress: list of past remediation sessions
        """
        # Query user masteries
        query = db.query(LearnerMastery).join(Topic).filter(LearnerMastery.user_id == user_id)
        if course_id:
            query = query.filter(Topic.course_id == course_id)
        masteries = query.all()

        # If user has no masteries, initialize from topics in course
        if not masteries and course_id:
            topics = db.query(Topic).filter(Topic.course_id == course_id).all()
            for t in topics:
                m = LearnerMastery(
                    user_id=user_id,
                    topic_id=t.id,
                    p_mastery=0.20,
                    understanding_score=0.0,
                    understanding_level=UNDERSTANDING_NOT_ASSESSED,
                    misconception_counts={},
                    history_scores=[],
                    total_attempts=0
                )
                db.add(m)
            db.commit()
            masteries = query.all()

        topics_data = []
        scores = []
        for m in masteries:
            topic = m.topic
            attempts = m.total_attempts or 0
            u_score = m.understanding_score or 0.0
            u_level = m.understanding_level or UNDERSTANDING_NOT_ASSESSED
            if attempts == 0:
                u_level = UNDERSTANDING_NOT_ASSESSED
            else:
                scores.append(u_score)

            # Calculate trend from history_scores
            trend = "steady"
            hist = m.history_scores or []
            if len(hist) >= 4:
                half = len(hist) // 2
                first_half_avg = sum(hist[:half]) / max(1, half)
                second_half_avg = sum(hist[half:]) / max(1, len(hist) - half)
                if second_half_avg - first_half_avg >= 0.10:
                    trend = "improving"
                elif first_half_avg - second_half_avg >= 0.10:
                    trend = "declining"

            topics_data.append({
                "topic_id": m.topic_id,
                "topic_name": topic.name if topic else f"Topic {m.topic_id}",
                "topic_code": topic.code if topic else "",
                "course_id": topic.course_id if topic else None,
                "understanding_score": round(u_score, 2),
                "understanding_level": u_level,
                "total_attempts": attempts,
                "correct_attempts": m.correct_attempts or 0,
                "p_mastery": round(m.p_mastery or 0.2, 2),
                "trend": trend,
                "misconception_counts": m.misconception_counts or {}
            })

        # Overall understanding metrics
        overall_score = round(sum(scores) / len(scores), 2) if scores else 0.0
        overall_level = get_understanding_level(overall_score, len(scores))

        # Strengths: topics with Strong level
        strengths = [
            t["topic_name"] for t in topics_data
            if t["understanding_level"] == UNDERSTANDING_STRONG
        ]

        # Weak concepts: sort by score ascending, pick top 3 Weak or Developing concepts
        weak_candidates = [
            t for t in topics_data
            if t["understanding_level"] in [UNDERSTANDING_WEAK, UNDERSTANDING_DEVELOPING] or (t["total_attempts"] > 0 and t["understanding_score"] < 0.75)
        ]
        weak_candidates.sort(key=lambda x: x["understanding_score"])
        top_weak = weak_candidates[:3]

        weak_concepts_out = []
        for wc in top_weak:
            tid = wc["topic_id"]
            # Top misconception detected
            m_counts = wc.get("misconception_counts", {})
            top_misconception = None
            if m_counts:
                top_misconception = max(m_counts.items(), key=lambda kv: kv[1])[0]

            # Evidence: recent responses for this topic
            evidence_responses = db.query(QuizResponse).join(Question).filter(
                QuizResponse.user_id == user_id,
                Question.topic_id == tid
            ).order_by(QuizResponse.submitted_at.desc()).limit(3).all()

            evidence_items = []
            citations = []
            for r in evidence_responses:
                q = r.question
                evidence_items.append({
                    "question_text": q.question_text if q else "Practice question",
                    "student_answer": r.user_answer,
                    "is_correct": r.is_correct,
                    "score_awarded": r.score_awarded,
                    "misconception_tag": r.misconception_tag,
                    "submitted_at": r.submitted_at.isoformat() if r.submitted_at else None
                })
                for c in (r.feedback_citations or (q.source_citations if q else [])):
                    if isinstance(c, dict) and c not in citations:
                        citations.append(c)

            if not top_misconception and evidence_items:
                for ev in evidence_items:
                    if ev.get("misconception_tag"):
                        top_misconception = ev["misconception_tag"]
                        break

            weak_concepts_out.append({
                "topic_id": tid,
                "concept_name": wc["topic_name"],
                "score": wc["understanding_score"],
                "level": wc["understanding_level"],
                "misconception": top_misconception or "Identified gaps in conceptual application.",
                "evidence": evidence_items,
                "citations": citations[:2]
            })

        # Plain language summary from stored numbers only
        plain_summary = cls._generate_plain_summary(strengths, weak_concepts_out, overall_level, overall_score)

        # Remediation history
        remediation_sessions = db.query(RemediationSession).filter(
            RemediationSession.user_id == user_id
        ).order_by(RemediationSession.created_at.desc()).limit(5).all()

        remediation_data = [
            {
                "id": s.id,
                "topic_id": s.topic_id,
                "concept_name": s.concept_name,
                "round_number": s.round_number,
                "score": s.score,
                "is_improving": s.is_improving,
                "status": s.status,
                "created_at": s.created_at.isoformat() if s.created_at else None
            }
            for s in remediation_sessions
        ]

        return {
            "overall_level": overall_level,
            "overall_score": overall_score,
            "topics": topics_data,
            "weak_concepts": weak_concepts_out,
            "strengths": strengths,
            "plain_summary": plain_summary,
            "remediation_sessions": remediation_data
        }

    @staticmethod
    def _generate_plain_summary(
        strengths: List[str],
        weak_concepts: List[Dict[str, Any]],
        overall_level: str,
        overall_score: float
    ) -> str:
        """Generates a strict, honest summary derived solely from numbers and detected tags."""
        if not strengths and not weak_concepts:
            return "No assessments completed yet. Take a diagnostic quiz to generate your baseline understanding profile."

        # Attempt to summarize using local model if available
        llm = None
        try:
            llm = get_llm()
        except Exception:
            llm = None

        if llm:
            try:
                weak_desc = "; ".join([f"{w['concept_name']} (misconception: {w['misconception']})" for w in weak_concepts])
                strength_desc = ", ".join(strengths) if strengths else "none yet"
                prompt = (
                    f"Write a 1-2 sentence plain-language student progress summary based ONLY on these stored metrics:\n"
                    f"- Overall understanding: {overall_level} ({overall_score*100:.0f}%)\n"
                    f"- Strong concepts: {strength_desc}\n"
                    f"- Weak concepts: {weak_desc}\n\n"
                    f"Rules: Do NOT invent concepts not in the list. Speak directly to the student ('You understand...'). Be encouraging, concise, and specific."
                )
                resp = llm.complete(prompt=prompt, system="Be a helpful, concise academic tutor.", temperature=0.2)
                if resp and resp.content and len(resp.content.strip()) > 15:
                    return resp.content.strip()
            except Exception as e:
                logger.warning(f"Model summary generation fallback: {e}")

        # Deterministic honest fallback
        parts = []
        if strengths:
            parts.append(f"You demonstrate strong understanding of {', '.join(strengths[:2])}.")
        if weak_concepts:
            top_w = weak_concepts[0]
            parts.append(f"Focus on {top_w['concept_name']}, where questions revealed: {top_w['misconception']}")
        return " ".join(parts) if parts else f"Your current understanding level is {overall_level} ({overall_score*100:.0f}%)."
