import re
from typing import List, Dict, Any, Tuple, Optional
from pydantic import BaseModel
import logging

from backend.app.ai.llm import get_llm

logger = logging.getLogger(__name__)

class KeywordRubric(BaseModel):
    keyword: str
    weight: float = 1.0
    synonyms: List[str] = []

class KeywordGradingResult(BaseModel):
    score: float
    is_correct: bool
    status: str  # "correct" (>=0.8), "partial" (0.5-0.8), "incorrect" (<0.5)
    covered_concepts: List[str]
    missed_concepts: List[str]
    feedback: str

class KeywordGrader:
    """
    Two-stage short-answer grader:
    1. Deterministic normalization & synonym/stem matching.
    2. Optional LLM meaning/paraphrase check on UNMATCHED keywords only.
    Never allows the model to lower a deterministic match.
    """
    @classmethod
    def _stem(cls, word: str) -> str:
        w = word.lower().strip()
        for suffix in ['ing', 'tion', 'tions', 'ies', 'es', 'ed', 'ly', 's']:
            if w.endswith(suffix) and len(w) - len(suffix) >= 3:
                return w[:-len(suffix)]
        return w

    @classmethod
    def _tokenize_stems(cls, text: str) -> set:
        words = re.findall(r'\b[a-zA-Z0-9_\-]{2,}\b', text.lower())
        return {cls._stem(w) for w in words}

    @classmethod
    def grade(
        cls,
        student_answer: str,
        model_answer: str,
        rubric: List[Dict[str, Any]],
        use_llm_paraphrase: bool = True
    ) -> KeywordGradingResult:
        """
        Grades student answer against rubric keywords.
        Score bands:
          >= 0.8: correct (is_correct=True, score=1.0 or actual score)
          0.5 <= score < 0.8: partially correct
          < 0.5: incorrect
        """
        if not rubric:
            # Fallback: extract 3-5 key terms from model answer
            words = [w.lower() for w in re.findall(r'\b[a-zA-Z]{4,}\b', model_answer)]
            rubric = [{"keyword": w, "weight": 1.0, "synonyms": []} for w in list(dict.fromkeys(words))[:4]]

        student_stems = cls._tokenize_stems(student_answer)
        student_clean = student_answer.lower()

        covered: List[str] = []
        unmatched: List[Dict[str, Any]] = []
        total_weight = sum(item.get("weight", 1.0) for item in rubric)
        matched_weight = 0.0

        # Stage 1: Deterministic check
        for item in rubric:
            kw = item.get("keyword", "")
            kw_stem = cls._stem(kw)
            weight = item.get("weight", 1.0)
            synonyms = item.get("synonyms", [])

            # Check direct phrase in text or stem match
            is_matched = (
                kw.lower() in student_clean or
                kw_stem in student_stems or
                any(syn.lower() in student_clean or cls._stem(syn) in student_stems for syn in synonyms)
            )

            if is_matched:
                covered.append(kw)
                matched_weight += weight
            else:
                unmatched.append(item)

        # Stage 2: Model paraphrase check on UNMATCHED items only
        if unmatched and use_llm_paraphrase:
            try:
                llm = get_llm()
                configured, _ = llm.check_health()
                if configured:
                    unmatched_names = [it["keyword"] for it in unmatched]
                    prompt = (
                        f"Student Answer: \"{student_answer}\"\n"
                        f"Model Reference: \"{model_answer}\"\n"
                        f"Target Concepts: {unmatched_names}\n\n"
                        f"Which of the target concepts did the student express the core meaning of using different words or paraphrasing?\n"
                        f"Return JSON format: {{\"paraphrased\": [\"concept1\"]}}"
                    )
                    class ParaphraseOutput(BaseModel):
                        paraphrased: List[str] = []

                    res = llm.complete_json(prompt=prompt, schema=ParaphraseOutput, temperature=0.1)
                    if res and res.paraphrased:
                        for p_kw in res.paraphrased:
                            for item in list(unmatched):
                                if item["keyword"].lower() == p_kw.lower() or p_kw.lower() in item["keyword"].lower():
                                    covered.append(item["keyword"])
                                    matched_weight += item.get("weight", 1.0)
                                    unmatched.remove(item)
            except Exception as e:
                logger.warning(f"Keyword paraphrase LLM check skipped: {e}")

        missed = [item["keyword"] for item in unmatched]
        score = round(matched_weight / max(1e-6, total_weight), 3)
        score = min(1.0, max(0.0, score))

        covered_clean = [c.rstrip(". ") for c in covered]
        missed_clean = [m.rstrip(". ") for m in missed]

        if score >= 0.80:
            status = "correct"
            is_correct = True
            feedback = f"Excellent! You accurately explained the key concepts: {', '.join(covered_clean)}."
        elif score >= 0.50:
            status = "partial"
            is_correct = False
            feedback = f"Partially correct. You covered {', '.join(covered_clean)}, but missed key details on: {', '.join(missed_clean)}."
        else:
            status = "incorrect"
            is_correct = False
            feedback = f"Incomplete explanation. Key missing concepts from the course material: {', '.join(missed_clean)}."

        feedback = re.sub(r'\.{2,}', '.', feedback.strip())

        return KeywordGradingResult(
            score=score,
            is_correct=is_correct,
            status=status,
            covered_concepts=covered,
            missed_concepts=missed,
            feedback=feedback
        )
