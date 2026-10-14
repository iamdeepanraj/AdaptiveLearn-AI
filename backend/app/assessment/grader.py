from typing import Dict, Any, List, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
import re
import json
import logging

from backend.app.models.quiz import Question, QuestionType, QuizSession, QuizResponse, QuizStatus
from backend.app.models.learner import LearnerMastery, MasteryHistory, MasteryState
from backend.app.models.course import Topic, Course
from backend.app.learner.bkt import (
    BayesianKnowledgeTracer,
    calculate_running_understanding_score,
    get_understanding_level,
    PARTIAL_CREDIT_THRESHOLD
)
from backend.app.learner_model.spaced_repetition import SpacedRepetitionScheduler
from backend.app.schemas.quiz import QuizResponseResult, AssessmentReport, AssessmentTopicBreakdown
from backend.app.schemas.document import SourceCitation
from backend.app.assessment.keyword_grader import KeywordGrader
from backend.app.assessment.expr import SafeExpressionEvaluator

logger = logging.getLogger(__name__)

class AssessmentGrader:
    @classmethod
    def grade_answer(
        cls,
        db: Session,
        user_id: int,
        quiz_session_id: int,
        question_id: int,
        user_answer: str,
        response_time_sec: Optional[float] = None,
        confidence_level: Optional[str] = "medium"
    ) -> QuizResponseResult:
        """
        Grades a submitted question with graded options (1 correct, 1 partial, 2 wrong),
        keyword short-answer grading, or numerical AST verification.
        Updates BKT with partial credit (score >= 0.75 as correct) and maintains running understanding score.
        """
        question = db.query(Question).filter(Question.id == question_id).first()
        if not question:
            raise ValueError(f"Question {question_id} not found.")

        topic = db.query(Topic).filter(Topic.id == question.topic_id).first()
        topic_name = topic.name if topic else "General Topic"

        clean_user_ans = user_answer.strip()
        clean_correct_ans = question.correct_answer.strip()
        is_correct = False
        score_awarded = 0.0
        misconception = None
        missing_detail = None
        selected_label = None
        selected_score = None
        selected_rationale = None
        revealed_options = []
        covered_kw = None
        missing_kw = None
        feedback_str = ""

        # 1. Deterministic & Pedagogical Grading by Question Type
        if question.question_type == QuestionType.MCQ:
            options = question.options or []
            correct_opt_obj = next(
                (o for o in options if str(o.get("label", "")).lower() == "correct" or o.get("key", "").upper() == clean_correct_ans.upper()),
                None
            )
            correct_opt_text = correct_opt_obj.get("text", clean_correct_ans) if correct_opt_obj else clean_correct_ans

            selected_opt = None
            for opt in options:
                if (opt.get("key", "").strip().upper() == clean_user_ans.upper() or
                    opt.get("text", "").strip().lower() == clean_user_ans.lower()):
                    selected_opt = opt
                    break

            if selected_opt:
                selected_label = str(selected_opt.get("label", "")).lower()
                selected_score = float(selected_opt.get("score", 1.0 if selected_label == "correct" or selected_opt.get("key", "").upper() == clean_correct_ans.upper() else 0.0))
                selected_rationale = selected_opt.get("rationale") or selected_opt.get("explanation")

                if selected_label == "correct" or (not selected_label and selected_opt.get("key", "").upper() == clean_correct_ans.upper()):
                    score_awarded = 1.0
                    is_correct = True
                    selected_label = "correct"
                    feedback_str = f"✅ Correct! (Score: 1.0) The concept is understood. {selected_rationale or question.explanation}"
                elif selected_label == "partial":
                    score_awarded = 0.5
                    is_correct = False
                    missing_detail = selected_opt.get("misconception") or selected_rationale or "Missed a critical nuance."
                    feedback_str = f"⚠️ Partially correct (Score: 0.5). You understand part of the idea, but missed a key detail: {missing_detail}. Fully correct answer: {correct_opt_text}."
                else:  # wrong
                    score_awarded = 0.0
                    is_correct = False
                    selected_label = "wrong"
                    misconception = selected_opt.get("misconception") or selected_rationale or f"Common misconception: Confused core concept with distractor '{clean_user_ans}'."
                    feedback_str = f"❌ Incorrect (Score: 0.0). Misconception detected: {misconception}. Fully correct answer: {correct_opt_text}."
            else:
                # Direct string/key comparison fallback
                is_correct = (clean_user_ans.upper() == clean_correct_ans.upper())
                score_awarded = 1.0 if is_correct else 0.0
                selected_label = "correct" if is_correct else "wrong"
                feedback_str = f"✅ Correct! {question.explanation}" if is_correct else f"❌ Incorrect. Correct answer: {clean_correct_ans}. {question.explanation}"
                if not is_correct:
                    misconception = f"Selected unlisted distractor '{clean_user_ans}'."

            # Construct revealed options breakdown with labels and rationales (answers now revealed post-response)
            for o in options:
                revealed_options.append({
                    "key": o.get("key"),
                    "text": o.get("text"),
                    "label": o.get("label", "correct" if o.get("key", "").upper() == clean_correct_ans.upper() else "wrong"),
                    "score": o.get("score", 1.0 if o.get("key", "").upper() == clean_correct_ans.upper() else 0.0),
                    "rationale": o.get("rationale") or o.get("explanation", ""),
                    "misconception": o.get("misconception")
                })

        elif question.question_type == QuestionType.SHORT_ANSWER:
            from backend.app.ai import get_llm
            active_llm = None
            try:
                active_llm = get_llm()
            except Exception:
                active_llm = None

            kw_result = KeywordGrader.grade(
                student_answer=clean_user_ans,
                model_answer=clean_correct_ans,
                keywords=question.options if isinstance(question.options, list) and question.options and "keyword" in question.options[0] else None,
                llm=active_llm
            )
            score_awarded = kw_result.score
            is_correct = (score_awarded >= 0.80)
            covered_kw = kw_result.covered_keywords
            missing_kw = kw_result.missing_keywords

            if score_awarded >= 0.80:
                feedback_str = f"✅ Correct ({score_awarded*100:.0f}% credit). Strong conceptual coverage of: {', '.join(covered_kw)}."
            elif score_awarded >= 0.50:
                missing_detail = f"Missing key ideas: {', '.join(missing_kw)}" if missing_kw else "Incomplete explanation."
                feedback_str = f"⚠️ Partially correct ({score_awarded*100:.0f}% credit). Covered: {', '.join(covered_kw)}. Missing key concepts: {', '.join(missing_kw)}."
            else:
                misconception = f"Incomplete understanding of {topic_name}. Missed key terms: {', '.join(missing_kw)}."
                feedback_str = f"❌ Incorrect ({score_awarded*100:.0f}% credit). Expected model answer: {clean_correct_ans}. Missing: {', '.join(missing_kw)}."

        elif question.question_type == QuestionType.NUMERICAL:
            tol = float(question.numerical_tolerance or 0.02)
            try:
                user_match = re.search(r'[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?', clean_user_ans.replace(",", ""))
                corr_match = re.search(r'[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?', clean_correct_ans.replace(",", ""))
                if user_match and corr_match:
                    u_val = float(user_match.group(0))
                    c_val = float(corr_match.group(0))
                    allowed_error = max(1e-4, abs(c_val) * tol)
                    if abs(u_val - c_val) <= allowed_error:
                        is_correct = True
                        score_awarded = 1.0
                        feedback_str = f"✅ Correct! (Score: 1.0). Result {u_val} matches expected answer {c_val} within ±{tol*100}%."
                    else:
                        is_correct = False
                        score_awarded = 0.0
                        misconception = f"Calculation or formula error: Submitted {u_val}, expected {c_val}."
                        feedback_str = f"❌ Incorrect (Score: 0.0). Expected {c_val} within ±{tol*100}%. {question.explanation}"
            except Exception as e:
                logger.warning(f"Failed numerical parsing: {e}")
                is_correct = False
                score_awarded = 0.0
                feedback_str = f"❌ Incorrect. Could not evaluate numerical answer."

        # 2. Update Bayesian Knowledge Tracing (BKT) & Running Understanding Score
        mastery = db.query(LearnerMastery).filter(
            LearnerMastery.user_id == user_id,
            LearnerMastery.topic_id == question.topic_id
        ).first()

        if not mastery:
            mastery = LearnerMastery(
                user_id=user_id,
                topic_id=question.topic_id,
                p_mastery=BayesianKnowledgeTracer.DEFAULT_P_INIT,
                p_transit=BayesianKnowledgeTracer.DEFAULT_P_TRANSIT,
                p_slip=BayesianKnowledgeTracer.DEFAULT_P_SLIP,
                p_guess=BayesianKnowledgeTracer.DEFAULT_P_GUESS,
                mastery_state=MasteryState.NOVICE,
                total_attempts=0,
                correct_attempts=0,
                understanding_score=0.0,
                understanding_level="Not assessed",
                misconception_counts={},
                history_scores=[]
            )
            db.add(mastery)
            db.commit()
            db.refresh(mastery)

        p_before = mastery.p_mastery
        # Treat score >= 0.75 as correct observation for BKT
        p_after, new_state = BayesianKnowledgeTracer.update_mastery(
            p_mastery_prior=p_before,
            observed_score=score_awarded,
            p_transit=mastery.p_transit,
            p_slip=mastery.p_slip,
            p_guess=mastery.p_guess
        )

        # Update running understanding score (recency-weighted mean)
        running_score, updated_history, under_level = calculate_running_understanding_score(
            history_scores=mastery.history_scores or [],
            new_score=score_awarded
        )

        mastery.p_mastery = p_after
        mastery.mastery_state = new_state
        mastery.understanding_score = running_score
        mastery.understanding_level = under_level
        mastery.history_scores = updated_history
        flag_modified(mastery, "history_scores")

        mastery.total_attempts += 1
        if is_correct:
            mastery.correct_attempts += 1
        mastery.last_accuracy = mastery.correct_attempts / max(1, mastery.total_attempts)
        mastery.last_practiced_at = datetime.utcnow()

        # Track misconceptions by concept
        recorded_misconception = misconception or missing_detail
        if recorded_misconception and score_awarded < 0.80:
            counts = dict(mastery.misconception_counts or {})
            counts[recorded_misconception] = counts.get(recorded_misconception, 0) + 1
            mastery.misconception_counts = counts
            flag_modified(mastery, "misconception_counts")

        # Update Spaced Repetition schedule
        next_due, reps, inter, ease = SpacedRepetitionScheduler.calculate_next_review(
            is_correct=is_correct,
            repetition_count=mastery.repetition_count,
            easiness_factor=mastery.easiness_factor,
            interval_days=mastery.interval_days
        )
        mastery.next_review_due_at = next_due
        mastery.repetition_count = reps
        mastery.interval_days = inter
        mastery.easiness_factor = ease

        # 3. Create QuizResponse record
        resp = QuizResponse(
            quiz_session_id=quiz_session_id,
            user_id=user_id,
            question_id=question_id,
            user_answer=clean_user_ans,
            is_correct=is_correct,
            score_awarded=score_awarded,
            feedback=feedback_str,
            feedback_citations=question.source_citations,
            misconception_tag=recorded_misconception,
            response_time_sec=response_time_sec,
            confidence_level=confidence_level
        )
        db.add(resp)
        db.commit()
        db.refresh(resp)

        # 4. Record Mastery History
        hist = MasteryHistory(
            user_id=user_id,
            topic_id=question.topic_id,
            quiz_session_id=quiz_session_id,
            quiz_response_id=resp.id,
            p_mastery_before=p_before,
            p_mastery_after=p_after,
            is_correct=is_correct
        )
        db.add(hist)
        db.commit()

        # Build Source Citations
        citations_out = []
        for c in (question.source_citations or []):
            if isinstance(c, dict):
                citations_out.append(SourceCitation(
                    chunk_id=c.get("chunk_id", 0),
                    document_id=c.get("document_id", 0),
                    document_name=c.get("document_name", "Course Document"),
                    source_type=c.get("source_type", "pdf"),
                    page=c.get("page"),
                    slide=c.get("slide"),
                    timestamp_start=c.get("timestamp_start"),
                    timestamp_end=c.get("timestamp_end"),
                    quote=c.get("quote", question.explanation[:120]),
                    similarity_score=1.0
                ))

        return QuizResponseResult(
            response_id=resp.id,
            question_id=question_id,
            is_correct=is_correct,
            score_awarded=score_awarded,
            correct_answer=clean_correct_ans,
            explanation=question.explanation,
            feedback=feedback_str,
            feedback_citations=citations_out,
            misconception_tag=recorded_misconception,
            option_label=selected_label,
            option_score=selected_score,
            option_rationale=selected_rationale,
            missing_detail=missing_detail,
            revealed_options=revealed_options if revealed_options else None,
            covered_keywords=covered_kw,
            missing_keywords=missing_kw,
            topic_id=question.topic_id,
            topic_name=topic_name,
            p_mastery_before=round(p_before, 4),
            p_mastery_after=round(p_after, 4),
            mastery_delta=round(p_after - p_before, 4),
            new_mastery_state=new_state.value if hasattr(new_state, 'value') else str(new_state),
            running_understanding_score=running_score,
            understanding_level=under_level
        )


    @classmethod
    def generate_assessment_report(cls, db: Session, quiz_session_id: int) -> AssessmentReport:
        """
        Generates full post-assessment report with strengths, misconceptions, and recommendations.
        """
        session = db.query(QuizSession).filter(QuizSession.id == quiz_session_id).first()
        if not session:
            raise ValueError(f"QuizSession {quiz_session_id} not found.")

        course = db.query(Course).filter(Course.id == session.course_id).first()
        course_title = course.title if course else "Course Assessment"

        responses = db.query(QuizResponse).filter(QuizResponse.quiz_session_id == quiz_session_id).all()
        
        total_q = len(responses)
        correct_q = sum(1 for r in responses if r.is_correct)
        score_pct = round((correct_q / max(1, total_q)) * 100, 1)

        # Update session score & status
        session.score = float(correct_q)
        session.max_score = float(total_q)
        session.status = QuizStatus.COMPLETED
        session.completed_at = datetime.utcnow()

        # Group responses by topic
        topic_stats: Dict[int, Dict[str, Any]] = {}
        misconceptions = []
        for r in responses:
            q = r.question
            tid = q.topic_id
            if tid not in topic_stats:
                topic_stats[tid] = {"attempted": 0, "correct": 0, "name": q.topic.name if q.topic else f"Topic {tid}"}
            topic_stats[tid]["attempted"] += 1
            if r.is_correct:
                topic_stats[tid]["correct"] += 1
            elif r.misconception_tag:
                misconceptions.append(r.misconception_tag)

        topic_breakdowns = []
        strengths = []
        weak_topics = []

        for tid, data in topic_stats.items():
            acc = round((data["correct"] / max(1, data["attempted"])) * 100, 1)
            # Fetch current mastery
            lm = db.query(LearnerMastery).filter(
                LearnerMastery.user_id == session.user_id,
                LearnerMastery.topic_id == tid
            ).first()
            p_m = lm.p_mastery if lm else 0.5
            state_val = lm.mastery_state.value if (lm and hasattr(lm.mastery_state, 'value')) else "learning"

            if acc >= 80.0:
                status_label = "strength"
                strengths.append(f"Strong command of {data['name']} ({acc}% accuracy)")
            elif acc >= 50.0:
                status_label = "developing"
            else:
                status_label = "weak"
                weak_topics.append(data['name'])

            topic_breakdowns.append(AssessmentTopicBreakdown(
                topic_id=tid,
                topic_name=data["name"],
                questions_attempted=data["attempted"],
                questions_correct=data["correct"],
                accuracy_percentage=acc,
                p_mastery=round(p_m, 3),
                mastery_state=state_val,
                status=status_label
            ))

        next_steps = []
        if weak_topics:
            next_steps.append(f"Review source materials and tutor explanations for: {', '.join(weak_topics[:2])}.")
        if strengths:
            next_steps.append("Proceed to advanced problem sets and downstream prerequisite concepts.")
        next_steps.append("Check your Spaced Repetition queue in 48 hours to retain learned concepts.")

        report = AssessmentReport(
            quiz_session_id=quiz_session_id,
            course_title=course_title,
            total_questions=total_q,
            correct_count=correct_q,
            score_percentage=score_pct,
            completed_at=session.completed_at,
            topic_breakdowns=topic_breakdowns,
            identified_misconceptions=list(set(misconceptions)),
            strengths=strengths if strengths else ["Completed diagnostic attempt"],
            recommended_next_steps=next_steps
        )

        session.assessment_report = json.loads(report.model_dump_json())
        db.commit()

        return report
