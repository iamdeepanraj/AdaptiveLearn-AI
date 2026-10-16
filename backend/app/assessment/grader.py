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
from backend.app.schemas.quiz import (
    QuizResponseResult, AssessmentReport, AssessmentTopicBreakdown,
    SectionScore, PerformanceComparison, QuestionStudentView
)
from backend.app.schemas.document import SourceCitation
from backend.app.assessment.generator import QuestionGenerator
from backend.app.assessment.keyword_grader import KeywordGrader
from backend.app.assessment.expr import SafeExpressionEvaluator

def clean_sentence_part(text: Optional[str]) -> str:
    """Trim whitespace and trailing periods, colons, commas, semicolons to prevent double full stops."""
    if not text:
        return ""
    s = str(text).strip()
    return s.rstrip(". \t\n,;:")

def join_clean_sentences(*parts: Optional[str]) -> str:
    """Cleanly joins sentence parts, trimming trailing punctuation from each part before joining."""
    cleaned = [clean_sentence_part(p) for p in parts if p and clean_sentence_part(p)]
    if not cleaned:
        return ""
    res = ". ".join(cleaned)
    if res and not res.endswith((".", "!", "?")):
        res += "."
    # Ensure no double full stops remain
    res = re.sub(r'\.{2,}', '.', res)
    return res

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
                    feedback_str = join_clean_sentences("✅ Correct! (Score: 1.0). The concept is understood", selected_rationale or question.explanation)
                elif selected_label == "partial":
                    score_awarded = 0.5
                    is_correct = False
                    missing_detail = clean_sentence_part(selected_opt.get("misconception") or selected_rationale or "Missed a critical nuance")
                    feedback_str = join_clean_sentences(f"⚠️ Partially correct (Score: 0.5). You understand part of the idea, but missed a key detail: {missing_detail}", f"Fully correct answer: {clean_sentence_part(correct_opt_text)}")
                else:  # wrong
                    score_awarded = 0.0
                    is_correct = False
                    selected_label = "wrong"
                    misconception = clean_sentence_part(selected_opt.get("misconception") or selected_rationale or f"Common misconception: Confused core concept with distractor '{clean_user_ans}'")
                    feedback_str = join_clean_sentences(f"❌ Incorrect (Score: 0.0). Misconception detected: {misconception}", f"Fully correct answer: {clean_sentence_part(correct_opt_text)}")
            else:
                # Direct string/key comparison fallback
                is_correct = (clean_user_ans.upper() == clean_correct_ans.upper())
                score_awarded = 1.0 if is_correct else 0.0
                selected_label = "correct" if is_correct else "wrong"
                feedback_str = join_clean_sentences("✅ Correct", question.explanation) if is_correct else join_clean_sentences(f"❌ Incorrect. Correct answer: {clean_sentence_part(clean_correct_ans)}", question.explanation)
                if not is_correct:
                    misconception = f"Selected unlisted distractor '{clean_user_ans}'."

            # Construct revealed options breakdown with labels and rationales (answers now revealed post-response)
            for o in options:
                revealed_options.append({
                    "key": o.get("key"),
                    "text": o.get("text"),
                    "label": o.get("label", "correct" if o.get("key", "").upper() == clean_correct_ans.upper() else "wrong"),
                    "score": o.get("score", 1.0 if o.get("key", "").upper() == clean_correct_ans.upper() else 0.0),
                    "rationale": clean_sentence_part(o.get("rationale") or o.get("explanation", "")),
                    "misconception": clean_sentence_part(o.get("misconception")) if o.get("misconception") else None
                })

        elif question.question_type == QuestionType.SHORT_ANSWER:
            active_rubric = question.options if isinstance(question.options, list) and question.options and "keyword" in question.options[0] else None
            kw_result = KeywordGrader.grade(
                student_answer=clean_user_ans,
                model_answer=clean_correct_ans,
                rubric=active_rubric,
                use_llm_paraphrase=True
            )
            score_awarded = kw_result.score
            is_correct = (score_awarded >= 0.80)
            covered_kw = [clean_sentence_part(k) for k in (getattr(kw_result, 'covered_concepts', None) or getattr(kw_result, 'covered_keywords', []))]
            missing_kw = [clean_sentence_part(k) for k in (getattr(kw_result, 'missed_concepts', None) or getattr(kw_result, 'missing_keywords', []))]

            if score_awarded >= 0.80:
                feedback_str = join_clean_sentences(f"✅ Correct ({score_awarded*100:.0f}% credit)", f"Strong conceptual coverage of: {', '.join(covered_kw)}")
            elif score_awarded >= 0.50:
                missing_detail = f"Missing key ideas: {', '.join(missing_kw)}" if missing_kw else "Incomplete explanation."
                feedback_str = join_clean_sentences(f"⚠️ Partially correct ({score_awarded*100:.0f}% credit)", f"Covered: {', '.join(covered_kw)}", f"Missing key concepts: {', '.join(missing_kw)}")
            else:
                misconception = f"Incomplete understanding of {topic_name}. Missed key terms: {', '.join(missing_kw)}."
                feedback_str = join_clean_sentences(f"❌ Incorrect ({score_awarded*100:.0f}% credit)", f"Expected model answer: {clean_sentence_part(clean_correct_ans)}", f"Missing: {', '.join(missing_kw)}")

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
                        feedback_str = join_clean_sentences(f"❌ Incorrect (Score: 0.0). Expected {c_val} within ±{tol*100}%", question.explanation)
            except Exception as e:
                logger.warning(f"Failed numerical parsing: {e}")
                is_correct = False
                score_awarded = 0.0
                feedback_str = "❌ Incorrect. Could not evaluate numerical answer."

        feedback_str = re.sub(r'\.{2,}', '.', feedback_str.strip())
        if feedback_str and not feedback_str.endswith(('.', '!', '?')):
            feedback_str += '.'

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

        # 1. Section Scores (Section A: MCQ, Section B: Short answers, Section C: Numerical problems)
        mcq_resps = [r for r in responses if r.question and r.question.question_type == QuestionType.MCQ]
        sa_resps = [r for r in responses if r.question and r.question.question_type == QuestionType.SHORT_ANSWER]
        num_resps = [r for r in responses if r.question and r.question.question_type == QuestionType.NUMERICAL]

        section_scores: List[SectionScore] = []
        for code, name, sec_resps in [
            ("A", "Section A: Multiple choice", mcq_resps),
            ("B", "Section B: Short answers", sa_resps),
            ("C", "Section C: Numerical problems", num_resps),
        ]:
            if sec_resps:
                q_count = len(sec_resps)
                sec_score = sum(r.score_awarded or 0.0 for r in sec_resps)
                sec_acc = round((sec_score / max(1.0, float(q_count))) * 100, 1)
                section_scores.append(SectionScore(
                    section_code=code,
                    section_name=name,
                    questions_count=q_count,
                    questions_answered=q_count,
                    total_score=round(sec_score, 2),
                    max_score=float(q_count),
                    accuracy_percentage=sec_acc
                ))

        # 2. MCQ vs Short-Answer comparison across recent history (current quiz + last 5 quizzes)
        recent_sessions = db.query(QuizSession).filter(
            QuizSession.user_id == session.user_id,
            QuizSession.id != session.id,
            QuizSession.status == QuizStatus.COMPLETED
        ).order_by(QuizSession.completed_at.desc()).limit(5).all()

        combined_session_ids = [session.id] + [s.id for s in recent_sessions]
        all_history_responses = db.query(QuizResponse).filter(
            QuizResponse.quiz_session_id.in_(combined_session_ids)
        ).all()

        hist_mcq = [r for r in all_history_responses if r.question and r.question.question_type == QuestionType.MCQ]
        hist_sa = [r for r in all_history_responses if r.question and r.question.question_type == QuestionType.SHORT_ANSWER]

        perf_comparison: Optional[PerformanceComparison] = None

        # Rule: Only compare when each section has at least 3 answered questions
        if len(hist_mcq) < 3 or len(hist_sa) < 3:
            perf_comparison = PerformanceComparison(
                has_comparison=False,
                reason=f"Diagnostic comparison requires at least 3 answered questions in both MCQ and Short-Answer sections (currently: {len(hist_mcq)} MCQ, {len(hist_sa)} Short Answer across recent quizzes)."
            )
        else:
            mcq_avg = sum(r.score_awarded or 0.0 for r in hist_mcq) / len(hist_mcq)
            sa_avg = sum(r.score_awarded or 0.0 for r in hist_sa) / len(hist_sa)
            gap = round(abs(mcq_avg - sa_avg), 3)

            quiz_topic_ids = list({r.question.topic_id for r in responses if r.question})
            if not quiz_topic_ids:
                quiz_topic_ids = list({r.question.topic_id for r in all_history_responses if r.question})

            if mcq_avg >= 0.7 and sa_avg < 0.5:
                # Case 1: MCQ is good (≥ 0.7) but short answers are weak (< 0.5)
                side_by_side = []
                all_missing_kw = []
                target_sa = sa_resps if sa_resps else hist_sa
                for r in target_sa:
                    q = r.question
                    if not q:
                        continue
                    covered = []
                    missing = []
                    rubric_list = getattr(q, 'grading_rubric', None) or (q.options if isinstance(q.options, list) and q.options and "keyword" in q.options[0] else [])
                    try:
                        g_res = KeywordGrader.grade(
                            student_answer=r.user_answer,
                            model_answer=q.correct_answer,
                            rubric=rubric_list,
                            use_llm_paraphrase=False
                        )
                        covered = g_res.covered_concepts
                        missing = g_res.missed_concepts
                    except Exception:
                        pass
                    all_missing_kw.extend(missing)
                    side_by_side.append({
                        "question": q.question_text,
                        "user_answer": r.user_answer,
                        "model_answer": q.correct_answer,
                        "missing_keywords": missing,
                        "covered_keywords": covered
                    })

                unique_missing = list(dict.fromkeys(all_missing_kw))[:8]

                practice_db_qs = db.query(Question).filter(
                    Question.topic_id.in_(quiz_topic_ids),
                    Question.question_type == QuestionType.SHORT_ANSWER
                ).limit(3).all()
                practice_views = [QuestionGenerator.format_student_safe_question(pq) for pq in practice_db_qs]

                perf_comparison = PerformanceComparison(
                    has_comparison=True,
                    mcq_score=round(mcq_avg, 3),
                    short_answer_score=round(sa_avg, 3),
                    gap=gap,
                    diagnosis_category="mcq_good_written_weak",
                    title="How to improve your written answers",
                    diagnosis="You recognize the right answer in multiple-choice questions, but cannot yet explain it clearly in your own words.",
                    suggestions=[
                        f"Key technical terms left out from your answers: {', '.join(unique_missing) if unique_missing else 'essential technical definitions'}.",
                        "Suggested structure: 1. Define the term clearly, 2. Explain how or why it operates, 3. Give one concrete example.",
                        "Compare your answer with the model answer below, where missing keywords are highlighted.",
                        "Practice with 3 targeted short-answer questions on these topics to build articulation fluency."
                    ],
                    missing_key_terms=unique_missing,
                    suggested_structure="Define the term, explain how or why it operates, and give one concrete example.",
                    side_by_side_answers=side_by_side,
                    practice_set_type="short_answer",
                    practice_questions=practice_views
                )

            elif sa_avg >= 0.7 and mcq_avg < 0.5:
                # Case 2: Short answers are good (≥ 0.7) but MCQ is weak (< 0.5)
                partial_count = 0
                partial_picks = []
                target_mcqs = mcq_resps if mcq_resps else hist_mcq
                for r in target_mcqs:
                    q = r.question
                    if not q or not q.options:
                        continue
                    user_clean = (r.user_answer or "").strip()
                    chosen_opt = None
                    corr_opt = None
                    for opt in q.options:
                        if isinstance(opt, dict):
                            if opt.get("key") == user_clean or opt.get("text") == user_clean:
                                chosen_opt = opt
                            if opt.get("label") == "correct" or opt.get("score", 0) == 1.0:
                                corr_opt = opt
                    if chosen_opt and chosen_opt.get("label") == "partial":
                        partial_count += 1
                        partial_picks.append({
                            "question": q.question_text,
                            "chosen_partial_option": chosen_opt.get("text", ""),
                            "correct_option": corr_opt.get("text", "") if corr_opt else q.correct_answer,
                            "missing_detail": chosen_opt.get("missing_detail") or chosen_opt.get("rationale") or "Missing critical qualifying detail"
                        })

                practice_db_qs = db.query(Question).filter(
                    Question.topic_id.in_(quiz_topic_ids),
                    Question.question_type == QuestionType.MCQ
                ).limit(3).all()
                practice_views = [QuestionGenerator.format_student_safe_question(pq) for pq in practice_db_qs]

                perf_comparison = PerformanceComparison(
                    has_comparison=True,
                    mcq_score=round(mcq_avg, 3),
                    short_answer_score=round(sa_avg, 3),
                    gap=gap,
                    diagnosis_category="written_good_mcq_weak",
                    title="How to improve on multiple choice",
                    diagnosis="You understand the core idea well when writing explanations, but get caught by close distractors in multiple-choice options.",
                    suggestions=[
                        f"You chose the 'partially correct' option {partial_count} times out of {len(target_mcqs)} questions ({round((partial_count / max(1, len(target_mcqs))) * 100)}%), which indicates you are missing subtle qualifying details.",
                        "Read every option completely before selecting. Eliminate clearly wrong options first so you can scrutinize the subtle difference between partial and full correctness.",
                        "Examine the partial options you selected next to the fully correct answers below, noting the exact missing detail.",
                        "Practice with 3 targeted multiple-choice questions on these topics."
                    ],
                    partial_distractor_analysis={
                        "partial_count": partial_count,
                        "total_mcqs": len(target_mcqs),
                        "partial_percentage": round((partial_count / max(1, len(target_mcqs))) * 100, 1)
                    },
                    partial_picks_comparison=partial_picks,
                    practice_set_type="mcq",
                    practice_questions=practice_views
                )

            elif mcq_avg < 0.5 and sa_avg < 0.5:
                # Case 3: Both are weak
                weak_names = [data["name"] for tid, data in topic_stats.items() if (data["correct"] / max(1, data["attempted"])) < 0.5]
                perf_comparison = PerformanceComparison(
                    has_comparison=True,
                    mcq_score=round(mcq_avg, 3),
                    short_answer_score=round(sa_avg, 3),
                    gap=gap,
                    diagnosis_category="both_weak",
                    title="Learn this again",
                    diagnosis="Foundational conceptual review needed across both multiple-choice recognition and written recall.",
                    suggestions=[
                        f"Review core principles for weak concepts: {', '.join(weak_names[:3]) if weak_names else 'your course topics'}.",
                        "Open the AI Tutor chat and ask for conceptual walkthroughs with worked examples.",
                        "Use 'Quick Revise' flashcards to reinforce definitions and key formulas before attempting another quiz."
                    ]
                )

            elif mcq_avg >= 0.7 and sa_avg >= 0.7:
                # Case 4: Both are good
                perf_comparison = PerformanceComparison(
                    has_comparison=True,
                    mcq_score=round(mcq_avg, 3),
                    short_answer_score=round(sa_avg, 3),
                    gap=gap,
                    diagnosis_category="both_good",
                    title="Mastery achieved: Ready for harder challenges",
                    diagnosis="Strong understanding demonstrated in both multiple-choice recognition and written explanation.",
                    suggestions=[
                        "You demonstrate well-rounded conceptual recall and technical articulation.",
                        "Advance to Rigorous difficulty drills with multi-step synthesis and edge cases.",
                        "Explore downstream advanced topics and prerequisite dependencies."
                    ]
                )

            else:
                # Case 5: Balanced or intermediate gap (< 0.25)
                perf_comparison = PerformanceComparison(
                    has_comparison=True,
                    mcq_score=round(mcq_avg, 3),
                    short_answer_score=round(sa_avg, 3),
                    gap=gap,
                    diagnosis_category="balanced",
                    title="Balanced conceptual performance",
                    diagnosis=f"MCQ accuracy ({round(mcq_avg*100)}%) and written explanation accuracy ({round(sa_avg*100)}%) are well-aligned (gap of {round(gap*100)} points).",
                    suggestions=[
                        "Continue balanced study across multiple-choice recognition and written synthesis.",
                        "Maintain active recall schedules to reinforce your understanding."
                    ]
                )

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
            recommended_next_steps=next_steps,
            section_scores=section_scores,
            performance_comparison=perf_comparison
        )

        session.assessment_report = json.loads(report.model_dump_json())
        db.commit()

        return report
