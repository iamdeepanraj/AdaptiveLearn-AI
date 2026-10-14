from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
import logging

from backend.app.retrieval.embeddings import embedding_service
from backend.app.retrieval.vector_store import VectorStore
from backend.app.retrieval.reranker import Reranker
from backend.app.schemas.document import SourceCitation

logger = logging.getLogger(__name__)

class HybridRetriever:
    @staticmethod
    def retrieve(
        db: Session,
        query: str,
        course_id: int,
        topic_id: Optional[int] = None,
        document_id: Optional[int] = None,
        top_k: int = 5,
        min_relevance_threshold: float = 0.22
    ) -> List[SourceCitation]:
        """
        Executes hybrid retrieval:
        1. Encodes query into dense embedding
        2. Retrieves candidate chunks using cosine similarity
        3. Reranks candidates using lexical precision & phrase coverage
        4. Returns strictly filtered, grounded SourceCitation objects
        """
        query_vec = embedding_service.get_embedding(query)
        candidates = VectorStore.search_similar_chunks(
            db=db,
            query_vector=query_vec,
            course_id=course_id,
            topic_id=topic_id,
            document_id=document_id,
            top_k=top_k * 2,
            min_similarity=0.10
        )

        if not candidates:
            return []

        reranked = Reranker.rerank(query=query, retrieved_candidates=candidates, top_n=top_k)
        
        citations = []
        for item in reranked:
            if item.get("rerank_score", 0.0) < min_relevance_threshold or item.get("matched_terms", 0) == 0:
                continue

            chunk = item["chunk"]
            # Generate excerpt quote (up to 200 chars)
            quote = chunk.content[:220].strip() + ("..." if len(chunk.content) > 220 else "")
            
            citations.append(SourceCitation(
                chunk_id=chunk.id,
                document_id=chunk.document_id,
                document_name=item["document_name"],
                source_type=chunk.source_type.value if hasattr(chunk.source_type, 'value') else str(chunk.source_type),
                page=chunk.page_number,
                slide=chunk.slide_number,
                timestamp_start=chunk.timestamp_start_sec,
                timestamp_end=chunk.timestamp_end_sec,
                quote=quote,
                figure_description=chunk.figure_description,
                similarity_score=round(item.get("rerank_score", item["similarity"]), 3)
            ))

        return citations
