from typing import List, Dict, Any, Optional
import numpy as np
from sqlalchemy.orm import Session
import logging

from backend.app.models.document import DocumentChunk, Document
from backend.app.schemas.document import SourceCitation

logger = logging.getLogger(__name__)

class VectorStore:
    @staticmethod
    def search_similar_chunks(
        db: Session,
        query_vector: List[float],
        course_id: int,
        topic_id: Optional[int] = None,
        document_id: Optional[int] = None,
        top_k: int = 5,
        min_similarity: float = 0.15
    ) -> List[Dict[str, Any]]:
        """
        Retrieves top_k document chunks ordered by cosine similarity with metadata and source coordinates.
        """
        query = db.query(DocumentChunk, Document.filename).join(Document, DocumentChunk.document_id == Document.id)\
            .filter(DocumentChunk.course_id == course_id)

        if topic_id:
            query = query.filter(DocumentChunk.topic_id == topic_id)
        if document_id:
            query = query.filter(DocumentChunk.document_id == document_id)

        chunk_rows = query.all()
        if not chunk_rows:
            return []

        q_vec = np.array(query_vector, dtype=np.float32)
        q_norm = np.linalg.norm(q_vec)
        if q_norm < 1e-6:
            return []

        scored_results = []
        for chunk, doc_filename in chunk_rows:
            if not chunk.embedding:
                continue
            chunk_vec = np.array(chunk.embedding, dtype=np.float32)
            c_norm = np.linalg.norm(chunk_vec)
            if c_norm < 1e-6:
                continue

            similarity = float(np.dot(q_vec, chunk_vec) / (q_norm * c_norm))

            if similarity >= min_similarity:
                scored_results.append({
                    "chunk": chunk,
                    "document_name": doc_filename,
                    "similarity": similarity
                })

        # Sort descending by similarity
        scored_results.sort(key=lambda x: x["similarity"], reverse=True)
        return scored_results[:top_k]
