import re
from typing import List, Dict, Any

class Reranker:
    @staticmethod
    def rerank(query: str, retrieved_candidates: List[Dict[str, Any]], top_n: int = 4) -> List[Dict[str, Any]]:
        """
        Reranks candidates using term coverage, exact phrase matching, and figure bonuses.
        """
        if not retrieved_candidates:
            return []

        STOPWORDS = {"what", "who", "when", "where", "which", "why", "how", "the", "and", "for", "with", "that", "this", "from", "are", "was", "were", "been", "have", "has", "had", "does", "did", "during", "about", "into"}
        query_terms = set(w for w in re.findall(r'\b[a-zA-Z0-9_\-]{3,}\b', query.lower()) if w not in STOPWORDS)
        if not query_terms:
            query_terms = set(re.findall(r'\b[a-zA-Z0-9_\-]{3,}\b', query.lower()))
        
        reranked = []
        for cand in retrieved_candidates:
            chunk = cand["chunk"]
            base_sim = cand["similarity"]
            text_lower = chunk.content.lower()
            
            # Exact term coverage
            matched_terms = sum(1 for term in query_terms if term in text_lower)
            coverage_score = matched_terms / max(1, len(query_terms))
            
            # If no substantive query terms match, zero out candidate score
            if matched_terms == 0:
                final_score = 0.0
            else:
                phrase_bonus = 0.15 if query.lower() in text_lower else 0.0
                figure_bonus = 0.05 if (chunk.figure_description and any(t in chunk.figure_description.lower() for t in query_terms)) else 0.0
                final_score = 0.60 * base_sim + 0.30 * coverage_score + phrase_bonus + figure_bonus

            cand_copy = dict(cand)
            cand_copy["rerank_score"] = float(final_score)
            cand_copy["matched_terms"] = matched_terms
            reranked.append(cand_copy)

        reranked.sort(key=lambda x: x["rerank_score"], reverse=True)
        return reranked[:top_n]
