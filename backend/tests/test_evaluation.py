import pytest
from backend.app.evaluation.metrics import EvaluationMetrics

def test_evaluation_faithfulness_metric():
    contexts = [
        "Backpropagation uses the recursive calculus chain rule to compute loss gradients with respect to weights.",
        "Gradient descent updates weights in the direction opposite to the gradient."
    ]
    # Highly faithful answer
    faithful_ans = "Backpropagation calculates loss gradients using the chain rule to update weights in gradient descent."
    f_score = EvaluationMetrics.calculate_faithfulness(faithful_ans, contexts)
    assert f_score >= 0.70

    # Unfaithful answer with hallucinations
    hallucinated_ans = "Quantum superconducting qubits rotate along the bloch sphere using laser pulses."
    h_score = EvaluationMetrics.calculate_faithfulness(hallucinated_ans, contexts)
    assert h_score < 0.20

def test_evaluation_abstention_metric():
    # Case 1: Unanswerable query where model correctly abstains
    abstain_ans = "Based on your uploaded course materials, there is insufficient information to answer this question."
    score_abstain = EvaluationMetrics.calculate_abstention_quality(
        answer=abstain_ans,
        has_insufficient_evidence=True,
        is_unanswerable=True
    )
    assert score_abstain == 1.0

    # Case 2: Unanswerable query where model hallucinates an answer
    fake_ans = "The prime minister was Henry Campbell-Bannerman who passed welfare reforms."
    score_hallucinated = EvaluationMetrics.calculate_abstention_quality(
        answer=fake_ans,
        has_insufficient_evidence=False,
        is_unanswerable=True
    )
    assert score_hallucinated == 0.0

def test_citation_validity_metric():
    citations = [
        {"document_id": 1, "page": 3, "slide": None, "timestamp_start": None},
        {"document_id": 2, "page": None, "slide": 5, "timestamp_start": None}
    ]
    valid_ids = [1, 2, 3]
    val_score = EvaluationMetrics.calculate_citation_validity(citations, valid_ids)
    assert val_score == 1.0

    # Fabricated doc id
    fake_citations = [{"document_id": 9999, "page": 1, "slide": None, "timestamp_start": None}]
    fake_score = EvaluationMetrics.calculate_citation_validity(fake_citations, valid_ids)
    assert fake_score == 0.0
