import re
from typing import List, Dict, Any, Optional
import numpy as np

class EvaluationMetrics:
    @staticmethod
    def calculate_faithfulness(answer: str, retrieved_contexts: List[str]) -> float:
        """
        Faithfulness: Measures whether the claims made in the answer are grounded
        in the retrieved contexts, preventing model hallucinations.
        Score: [0.0, 1.0]
        """
        if not retrieved_contexts or not answer:
            return 0.0

        # Extract factual candidate terms (words of length >= 4) from answer
        answer_words = set(re.findall(r'\b[a-zA-Z]{4,}\b', answer.lower()))
        combined_context = " ".join(retrieved_contexts).lower()

        if not answer_words:
            return 1.0

        grounded_count = sum(1 for w in answer_words if w in combined_context)
        return round(float(grounded_count / len(answer_words)), 4)

    @staticmethod
    def calculate_answer_relevancy(answer: str, query: str) -> float:
        """
        Answer Relevancy: Measures how directly the generated response addresses the query.
        Score: [0.0, 1.0]
        """
        query_terms = set(re.findall(r'\b[a-zA-Z]{3,}\b', query.lower()))
        if not query_terms:
            return 1.0

        ans_lower = answer.lower()
        matched = sum(1 for t in query_terms if t in ans_lower)
        coverage = matched / len(query_terms)

        # Penalize if answer is excessively terse or empty
        length_penalty = 1.0 if len(answer.split()) >= 15 else 0.5
        return round(float(coverage * length_penalty), 4)

    @staticmethod
    def calculate_context_precision(
        retrieved_items: List[Dict[str, Any]],
        expected_filename: Optional[str],
        expected_page_or_slide: Optional[int]
    ) -> float:
        """
        Context Precision: Measures whether relevant source chunks appear higher
        in the ranked retrieval list (Mean Average Precision style).
        Score: [0.0, 1.0]
        """
        if not expected_filename or not retrieved_items:
            return 0.0

        hits = []
        for item in retrieved_items:
            doc_name = item.get("document_name", "").lower()
            page = item.get("page") or item.get("slide")
            is_match = (expected_filename.lower() in doc_name)
            if expected_page_or_slide is not None and page is not None:
                is_match = is_match and (abs(page - expected_page_or_slide) <= 1)
            hits.append(1 if is_match else 0)

        if not any(hits):
            return 0.0

        precisions = []
        cum_hits = 0
        for rank, hit in enumerate(hits, start=1):
            if hit == 1:
                cum_hits += 1
                precisions.append(cum_hits / rank)

        return round(float(sum(precisions) / max(1, len(precisions))), 4)

    @staticmethod
    def calculate_context_recall(
        retrieved_items: List[Dict[str, Any]],
        expected_filename: Optional[str],
        expected_page_or_slide: Optional[int]
    ) -> float:
        """
        Context Recall: Measures whether the ground truth passage was successfully retrieved.
        Score: [0.0, 1.0]
        """
        if not expected_filename:
            return 1.0

        for item in retrieved_items:
            doc_name = item.get("document_name", "").lower()
            page = item.get("page") or item.get("slide")
            if expected_filename.lower() in doc_name:
                if expected_page_or_slide is None or page is None or abs(page - expected_page_or_slide) <= 1:
                    return 1.0
        return 0.0

    @staticmethod
    def calculate_citation_validity(
        citations: List[Dict[str, Any]],
        existing_doc_ids: List[int]
    ) -> float:
        """
        Citation Validity: Verifies that 100% of generated citations reference
        actual, existing database documents without fabricated document IDs or page numbers.
        """
        if not citations:
            return 1.0

        valid_count = 0
        for c in citations:
            doc_id = c.get("document_id")
            page = c.get("page")
            slide = c.get("slide")
            ts = c.get("timestamp_start")

            has_valid_loc = (page is not None and page > 0) or (slide is not None and slide > 0) or (ts is not None and ts >= 0)
            if doc_id in existing_doc_ids and has_valid_loc:
                valid_count += 1

        return round(float(valid_count / len(citations)), 4)

    @staticmethod
    def calculate_abstention_quality(
        answer: str,
        has_insufficient_evidence: bool,
        is_unanswerable: bool
    ) -> float:
        """
        Abstention Quality: Verifies that when a question cannot be answered
        from the materials, the model honestly and clearly states it without fabricating facts.
        """
        abstention_phrases = [
            "insufficient information",
            "could not find",
            "insufficient evidence",
            "not covered in",
            "only provide explanations grounded"
        ]
        has_abstention_phrase = any(p in answer.lower() for p in abstention_phrases)

        if is_unanswerable:
            # Model should abstain
            return 1.0 if (has_insufficient_evidence or has_abstention_phrase) else 0.0
        else:
            # Model should NOT falsely abstain on answerable questions
            return 0.0 if (has_insufficient_evidence and has_abstention_phrase) else 1.0
