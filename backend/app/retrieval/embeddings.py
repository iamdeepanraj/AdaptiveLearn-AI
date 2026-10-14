import math
import hashlib
import re
from typing import List, Union
import numpy as np
import logging
from backend.app.config import settings

logger = logging.getLogger(__name__)

class DeterministicDenseEmbedder:
    """
    A lightweight, deterministic subword and n-gram dense embedding generator (dimension 256).
    Produces normalized unit vectors where texts sharing concepts, terms, and context
    have high cosine similarity. Zero external network dependency or paid API requirement,
    enabling reproducible test suites and immediate offline execution.
    """
    def __init__(self, dimension: int = 256):
        self.dim = dimension

    def embed_text(self, text: str) -> List[float]:
        if not text:
            return [0.0] * self.dim

        vec = np.zeros(self.dim, dtype=np.float32)
        words = re.findall(r'\b[a-zA-Z0-9_\-]{2,}\b', text.lower())

        if not words:
            return [0.0] * self.dim

        for i, word in enumerate(words):
            # Token hash
            h_val = int(hashlib.md5(word.encode('utf-8')).hexdigest(), 16)
            idx = h_val % self.dim
            sign = 1.0 if ((h_val >> 8) & 1) else -1.0
            
            # Position-weighted term frequency
            weight = 1.0 + (1.0 / (1.0 + 0.05 * min(i, 20)))
            vec[idx] += sign * weight

            # Bigram feature
            if i < len(words) - 1:
                bigram = f"{word}_{words[i+1]}"
                b_hash = int(hashlib.sha256(bigram.encode('utf-8')).hexdigest(), 16)
                b_idx = b_hash % self.dim
                b_sign = 1.0 if ((b_hash >> 8) & 1) else -1.0
                vec[b_idx] += b_sign * 1.5

        # L2 Normalize
        norm = np.linalg.norm(vec)
        if norm > 1e-6:
            vec = vec / norm
        return vec.tolist()

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        return [self.embed_text(t) for t in texts]

class EmbeddingService:
    def __init__(self):
        self.provider = settings.EMBEDDING_PROVIDER
        self.embedder = DeterministicDenseEmbedder(dimension=settings.EMBEDDING_DIMENSION)

    def get_embedding(self, text: str) -> List[float]:
        if self.provider == "ollama":
            try:
                import httpx
                resp = httpx.post(
                    f"{settings.OLLAMA_BASE_URL.rstrip('/')}/api/embed",
                    json={"model": settings.OLLAMA_EMBED_MODEL, "input": text[:4000]},
                    timeout=20.0
                )
                if resp.status_code == 200:
                    data = resp.json()
                    embeds = data.get("embeddings", [])
                    raw_vec = embeds[0] if embeds else data.get("embedding", [])
                    if raw_vec:
                        # Project or adapt to target dimension (settings.EMBEDDING_DIMENSION)
                        target_dim = settings.EMBEDDING_DIMENSION
                        if len(raw_vec) == target_dim:
                            return raw_vec
                        elif len(raw_vec) > target_dim:
                            # Truncate and L2-normalize
                            arr = np.array(raw_vec[:target_dim], dtype=np.float32)
                            norm = np.linalg.norm(arr)
                            return (arr / max(1e-6, norm)).tolist()
                        else:
                            padded = raw_vec + [0.0] * (target_dim - len(raw_vec))
                            return padded
            except Exception as e:
                logger.warning(f"Ollama embedding failed ({e}), falling back to deterministic dense embedder.")

        elif self.provider == "openai" and settings.OPENAI_API_KEY:
            try:
                import httpx
                resp = httpx.post(
                    "https://api.openai.com/v1/embeddings",
                    headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}"},
                    json={"input": text[:8000], "model": "text-embedding-3-small"},
                    timeout=20.0
                )
                if resp.status_code == 200:
                    return resp.json()["data"][0]["embedding"]
            except Exception as e:
                logger.warning(f"OpenAI embedding failed, falling back to local dense embedder: {e}")

        return self.embedder.embed_text(text)

    def get_embeddings(self, texts: List[str]) -> List[List[float]]:
        return [self.get_embedding(t) for t in texts]

embedding_service = EmbeddingService()
