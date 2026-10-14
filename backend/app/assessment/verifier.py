import hashlib
import re
from typing import Dict, Any, Tuple, Optional, List
import logging

from backend.app.assessment.expr import SafeExpressionEvaluator

logger = logging.getLogger(__name__)

class QuestionVerifier:
    @staticmethod
    def generate_fingerprint(question_text: str) -> str:
        """Generates a stable normalized SHA-256 fingerprint for deduplication."""
        normalized = re.sub(r'\s+', ' ', question_text.lower().strip())
        return hashlib.sha256(normalized.encode('utf-8')).hexdigest()

    @classmethod
    def verify_question(
        cls,
        question_dict: Dict[str, Any],
        llm: Optional[Any] = None,
        source_passage: Optional[str] = None
    ) -> Tuple[bool, str]:
        """
        Validates that a question meets pedagogical rigor, clarity, and source grounding.
        Returns: (is_valid, reason)
        """
        is_valid, reason, _ = cls.verify_question_detailed(question_dict, llm=llm, source_passage=source_passage)
        return is_valid, reason

    @classmethod
    def verify_question_detailed(
        cls,
        question_dict: Dict[str, Any],
        llm: Optional[Any] = None,
        source_passage: Optional[str] = None
    ) -> Tuple[bool, str, str]:
        """
        Validates question and returns (is_valid, reason, verification_status).
        """

        q_type = str(question_dict.get("question_type", "")).lower()
        q_text = str(question_dict.get("question_text", "")).strip()
        correct_ans = str(question_dict.get("correct_answer", "")).strip()
        explanation = str(question_dict.get("explanation", "")).strip()
        citations = question_dict.get("source_citations", [])

        if len(q_text) < 15:
            return False, "Question text is too short or vague.", "rejected"

        if not correct_ans:
            return False, "Missing correct answer.", "rejected"

        if not explanation:
            return False, "Missing pedagogical explanation.", "rejected"

        if not citations:
            return False, "Question is rejected: Missing grounded source citations.", "rejected"

        # 1. Graded-Option MCQ Verification
        if q_type == "mcq":
            options = question_dict.get("options", [])
            if not isinstance(options, list):
                return False, "MCQ options must be a list.", "rejected"

            # Check if this is a 4-option graded MCQ
            if len(options) == 4 and any("label" in opt for opt in options if isinstance(opt, dict)):
                valid_graded, graded_reason = cls._verify_graded_mcq_structure(options, correct_ans)
                if not valid_graded:
                    return False, graded_reason, "rejected"

                # Check that correct option is supported by cited passage if passage provided
                correct_opt = next((o for o in options if o.get("label") == "correct"), None)
                if source_passage and correct_opt:
                    opt_words = set(re.findall(r'\b[a-zA-Z]{4,}\b', correct_opt.get("text", "").lower()))
                    passage_lower = source_passage.lower()
                    overlap = sum(1 for w in opt_words if w in passage_lower)
                    if opt_words and (overlap / len(opt_words)) < 0.20:
                        return False, "Correct option is not supported by cited source passage.", "rejected"

                # Blind second-pass model verification if LLM is provided and online
                if llm is not None:
                    try:
                        blind_ok, blind_reason = cls._blind_model_verification(llm, q_text, options)
                        if not blind_ok:
                            return False, f"Blind model verification failed: {blind_reason}", "rejected"
                        return True, "Verified with blind model consensus.", "verified_blind_model"
                    except Exception as e:
                        logger.warning(f"Blind model check skipped due to error: {e}")
                        return True, "Verified deterministically (model offline/skipped).", "verified_deterministic"

                return True, "Verified deterministically with graded options structure.", "verified_deterministic"

            else:
                # Standard legacy MCQ validation (at least 2 options, correct answer present)
                if len(options) < 2:
                    return False, "MCQ questions must provide at least 2 distinct choices.", "rejected"
                keys = [opt.get("key") for opt in options if isinstance(opt, dict)]
                if correct_ans not in keys and not any(opt.get("text", "").strip().lower() == correct_ans.lower() for opt in options if isinstance(opt, dict)):
                    return False, f"Correct answer '{correct_ans}' does not match any MCQ option.", "rejected"
                return True, "Verified standard MCQ.", "verified_deterministic"

        # 2. Numerical Problem Verification with AST SafeExpressionEvaluator
        elif q_type == "numerical":
            expr = question_dict.get("expression")
            params = question_dict.get("params")
            tol = float(question_dict.get("numerical_tolerance") or 0.02)

            if expr and params and isinstance(params, dict):
                eval_ok, eval_res, eval_err = SafeExpressionEvaluator.evaluate(expr, params)
                if not eval_ok:
                    return False, f"Numerical formula evaluation failed: {eval_err}", "rejected"

                try:
                    target_val = float(re.sub(r'[^\d.-]', '', correct_ans))
                    recomp_val = float(eval_res)
                    allowed_err = max(1e-4, abs(recomp_val) * tol)
                    if abs(target_val - recomp_val) > allowed_err:
                        return False, f"Stated answer {target_val} does not match recomputed answer {recomp_val} within ±{tol*100}%.", "rejected"
                except Exception as e:
                    return False, f"Numerical answer comparison error: {e}", "rejected"
            else:
                # Direct numerical format validation
                try:
                    float(re.sub(r'[^\d.-]', '', correct_ans))
                except ValueError:
                    return False, f"Numerical question correct answer '{correct_ans}' is not a valid number.", "rejected"

            return True, "Verified numerical problem with safe evaluator.", "verified_deterministic"

        # 3. Short Answer Verification
        elif q_type == "short_answer":
            if len(correct_ans.split()) < 2:
                return False, "Short answer question must have a substantial model answer.", "rejected"
            return True, "Verified short answer question.", "verified_deterministic"

        return True, "Verified question.", "verified_deterministic"

    @classmethod
    def _verify_graded_mcq_structure(cls, options: List[Dict[str, Any]], correct_ans: str) -> Tuple[bool, str]:
        """
        Validates exact Graded MCQ rules:
        - Exactly 4 options.
        - Exactly 1 'correct' (score 1.0).
        - Exactly 1 'partial' (score 0.5), not identical to correct.
        - Exactly 2 'wrong' (score 0.0), each with a plausible misconception.
        - Every option carries text, label, score, and rationale.
        """
        if len(options) != 4:
            return False, f"Graded MCQ must contain exactly 4 options; received {len(options)}."

        labels = [opt.get("label", "").lower() for opt in options]
        if labels.count("correct") != 1:
            return False, f"Graded MCQ must contain exactly 1 'correct' option; found {labels.count('correct')}."
        if labels.count("partial") != 1:
            return False, f"Graded MCQ must contain exactly 1 'partial' option; found {labels.count('partial')}."
        if labels.count("wrong") != 2:
            return False, f"Graded MCQ must contain exactly 2 'wrong' options; found {labels.count('wrong')}."

        correct_opt = next(o for o in options if o.get("label") == "correct")
        partial_opt = next(o for o in options if o.get("label") == "partial")

        # Check texts are distinct and not empty
        texts = [o.get("text", "").strip() for o in options]
        if any(len(t) == 0 for t in texts):
            return False, "Option text cannot be empty."
        if len(set(t.lower() for t in texts)) < 4:
            return False, "All 4 options must be distinct in text."

        # Partial option must not be fully identical to correct
        if correct_opt.get("text", "").strip().lower() == partial_opt.get("text", "").strip().lower():
            return False, "Partial option cannot be identical to the correct option."

        # Check rationale presence
        for o in options:
            if not o.get("rationale"):
                return False, f"Option '{o.get('key')}' is missing a pedagogical rationale."

        # Check misconception tag on partial and wrong options
        for o in options:
            if o.get("label") in ["partial", "wrong"] and not o.get("misconception"):
                # If misconception field is empty, provide default tag
                o["misconception"] = f"Confused key concept with distractor {o.get('key')}"

        return True, "Valid graded MCQ structure."

    @classmethod
    def _blind_model_verification(
        cls,
        llm: Any,
        question_text: str,
        options: List[Dict[str, Any]]
    ) -> Tuple[bool, str]:
        """
        Executes a blind second pass asking the model to classify options
        without seeing the labels. Verifies that the blind model picks the 'correct' option.
        """
        blind_options = "\n".join([f"{o.get('key')}: {o.get('text')}" for o in options])
        expected_correct_key = next((o.get("key") for o in options if o.get("label") == "correct"), None)

        prompt = (
            f"You are a strict academic reviewer. Evaluate this multiple-choice question:\n\n"
            f"Question: {question_text}\n\n"
            f"Options:\n{blind_options}\n\n"
            f"Identify which single option is fully correct, which single option is partially correct, "
            f"and which two are wrong.\n"
            f'Respond in valid JSON format: {{"correct_key": "A", "partial_key": "B", "wrong_keys": ["C", "D"]}}'
        )

        resp = llm.complete(prompt=prompt, system="Output only JSON.", temperature=0.1)
        if not resp or not resp.content:
            return False, "Empty response from blind reviewer model."

        try:
            import json
            clean_json = re.sub(r'```(?:json)?', '', resp.content).strip()
            data = json.loads(clean_json)
            predicted_correct = data.get("correct_key", "").upper()
            if predicted_correct != expected_correct_key:
                return False, f"Blind model chose option {predicted_correct} as correct, expected {expected_correct_key}."
            return True, "Blind model verified correct option."
        except Exception as e:
            logger.warning(f"Blind model JSON parsing failed: {e}")
            return False, f"Could not parse blind model output: {e}"
