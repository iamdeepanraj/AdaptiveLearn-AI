import pytest
import numpy as np
from backend.app.retrieval.embeddings import DeterministicDenseEmbedder, embedding_service
from backend.app.retrieval.reranker import Reranker

def test_deterministic_dense_embeddings():
    embedder = DeterministicDenseEmbedder(dimension=256)
    vec1 = embedder.embed_text("Gradient descent optimization minimizes neural network loss.")
    vec2 = embedder.embed_text("Gradient descent updates network weights by minimizing loss.")
    vec3 = embedder.embed_text("The recipe calls for three tablespoons of vanilla extract.")

    assert len(vec1) == 256
    norm1 = np.linalg.norm(vec1)
    assert abs(norm1 - 1.0) < 1e-4

    # Semantic similarity between related machine learning queries
    sim_12 = np.dot(vec1, vec2)
    sim_13 = np.dot(vec1, vec3)

    assert sim_12 > sim_13
    assert sim_12 > 0.25

def test_reranker_prioritizes_exact_matches():
    query = "backpropagation chain rule"
    
    class DummyChunk:
        def __init__(self, content, fig=None):
            self.content = content
            self.figure_description = fig

    candidates = [
        {"chunk": DummyChunk("The model uses stochastic gradient descent for general optimization."), "similarity": 0.40},
        {"chunk": DummyChunk("Backpropagation computes gradients recursively via the calculus chain rule backward."), "similarity": 0.38}
    ]

    reranked = Reranker.rerank(query=query, retrieved_candidates=candidates, top_n=2)
    assert len(reranked) == 2
    # Second candidate should be promoted to #1 because of exact phrase and keyword coverage
    assert "chain rule" in reranked[0]["chunk"].content.lower()
