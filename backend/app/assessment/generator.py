from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
import random
import re
import json
import logging

from backend.app.models.quiz import Question, QuestionType, DifficultyLevel, QuizResponse
from backend.app.models.course import Topic
from backend.app.models.document import DocumentChunk
from backend.app.assessment.verifier import QuestionVerifier
from backend.app.assessment.expr import SafeExpressionEvaluator
from backend.app.schemas.quiz import QuestionStudentView, QuestionOption

logger = logging.getLogger(__name__)

class QuestionGenerator:
    @staticmethod
    def get_adaptive_questions_for_student(
        db: Session,
        user_id: int,
        course_id: int,
        topic_ids: Optional[List[int]] = None,
        question_types: Optional[List[str]] = None,
        difficulty_mode: str = "adaptive",
        target_count: int = 5,
        target_mastery: float = 0.50,
        exclude_ids: Optional[List[int]] = None
    ) -> List[Question]:
        """
        Retrieves a non-repeating set of questions adaptively calibrated to student ability.
        - Excludes questions the student has already answered.
        - Supports filtering by question types (mcq, short_answer, numerical).
        - Calibrates difficulty:
          * If mastery is low (< 0.40): pick EASY questions first.
          * If mastery is medium (0.40 - 0.75): pick MEDIUM questions.
          * If mastery is high (>= 0.75): pick HARD questions.
        """
        # Find already answered question IDs for non-repetition
        answered_q_ids = [
            r[0] for r in db.query(QuizResponse.question_id).filter(
                QuizResponse.user_id == user_id
            ).all()
        ]
        if exclude_ids:
            answered_q_ids = list(set(answered_q_ids + exclude_ids))

        query = db.query(Question).filter(
            Question.course_id == course_id,
            Question.is_verified == True
        )

        if topic_ids:
            query = query.filter(Question.topic_id.in_(topic_ids))

        if question_types:
            type_enums = []
            for qt in question_types:
                try:
                    type_enums.append(QuestionType(qt.lower()))
                except ValueError:
                    pass
            if type_enums:
                query = query.filter(Question.question_type.in_(type_enums))

        # Filter out previously served questions
        if answered_q_ids:
            unanswered_query = query.filter(~Question.id.in_(answered_q_ids))
            available_pool = unanswered_query.all()
            if len(available_pool) < target_count:
                available_pool = query.all()
        else:
            available_pool = query.all()

        if not available_pool:
            return []

        # If adaptive mode, select by target difficulty
        if difficulty_mode == "adaptive":
            if target_mastery < 0.40:
                target_diff = DifficultyLevel.EASY
            elif target_mastery < 0.75:
                target_diff = DifficultyLevel.MEDIUM
            else:
                target_diff = DifficultyLevel.HARD
            
            matching = [q for q in available_pool if q.difficulty == target_diff]
            non_matching = [q for q in available_pool if q.difficulty != target_diff]
            selected = matching[:target_count]
            if len(selected) < target_count:
                selected.extend(non_matching[:(target_count - len(selected))])
            return selected
        else:
            diff_enum = DifficultyLevel(difficulty_mode) if difficulty_mode in ["easy", "medium", "hard"] else None
            if diff_enum:
                filtered = [q for q in available_pool if q.difficulty == diff_enum]
                if len(filtered) >= target_count:
                    return random.sample(filtered, target_count)
            return random.sample(available_pool, min(len(available_pool), target_count))

    @staticmethod
    def format_student_safe_question(q: Question) -> QuestionStudentView:
        """
        Builds a student-safe question representation.
        Shuffles MCQ options and strictly strips labels, scores, and correct answers.
        """
        opts = []
        if q.options and isinstance(q.options, list):
            # Shallow copy and shuffle options
            shuffled_options = list(q.options)
            random.shuffle(shuffled_options)
            for idx, o in enumerate(shuffled_options):
                if isinstance(o, dict) and "text" in o:
                    key = o.get("key") or chr(65 + idx)
                    opts.append(QuestionOption(key=key, text=o["text"]))

        return QuestionStudentView(
            id=q.id,
            topic_id=q.topic_id,
            topic_name=q.topic.name if q.topic else "Course Topic",
            question_type=q.question_type.value if hasattr(q.question_type, 'value') else str(q.question_type),
            difficulty=q.difficulty.value if hasattr(q.difficulty, 'value') else str(q.difficulty),
            question_text=q.question_text,
            options=opts if opts else None
        )

    @staticmethod
    def generate_numerical_problem(
        chunk_text: str,
        chunk_id: int,
        topic_id: int,
        difficulty: str = "easy",
        llm: Optional[Any] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Generates numerical problem from material and verifies it with SafeExpressionEvaluator:
        - easy: direct substitution
        - medium: rearrange formula or use two steps
        - hard: combine two formulas from the material
        Recomputes answer; rejects if stated answer doesn't match recomputed one.
        """
        prompt = (
            f"Analyze this course material and extract a quantitative relationship or formula:\n\n"
            f"Material:\n{chunk_text[:1200]}\n\n"
            f"Generate a numerical practice problem of difficulty '{difficulty}'.\n"
            f"- easy: direct substitution\n"
            f"- medium: rearrange the formula or use two steps\n"
            f"- hard: combine two formulas from the material\n\n"
            f"Return ONLY valid JSON with keys:\n"
            f'{{"stem": "...", "expression": "...", "params": {{"var": 1.0}}, "answer": 1.0, "unit": "...", "worked_solution": "..."}}'
        )

        if not llm:
            return None

        try:
            resp = llm.complete(prompt=prompt, system="Output only JSON.", temperature=0.6)
            if not resp or not resp.content:
                return None
            clean_json = re.sub(r'```(?:json)?', '', resp.content).strip()
            data = json.loads(clean_json)

            expr = data.get("expression", "")
            params = data.get("params", {})
            stated_ans = float(data.get("answer"))

            # Recompute answer with safe evaluator
            ok, recomputed_val, err = SafeExpressionEvaluator.evaluate(expr, params)
            if not ok:
                logger.warning(f"Rejected generated numerical question: {err}")
                return None

            if abs(recomputed_val - stated_ans) > max(1e-4, abs(stated_ans) * 0.02):
                logger.warning(f"Rejected numerical problem: stated {stated_ans} != recomputed {recomputed_val}")
                return None

            data["source_chunk_id"] = chunk_id
            data["topic_id"] = topic_id
            data["recomputed_answer"] = recomputed_val
            return data
        except Exception as e:
            logger.warning(f"Failed to generate numerical problem: {e}")
            return None
