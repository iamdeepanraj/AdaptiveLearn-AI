import pytest
from unittest.mock import patch, MagicMock
from backend.app.assessment.keyword_grader import KeywordGrader

def test_keyword_grader_exact_and_stem_matches():
    rubric = [
        {"keyword": "gradient descent", "weight": 1.0, "synonyms": ["steepest descent"]},
        {"keyword": "learning rate", "weight": 1.0, "synonyms": ["step size"]},
        {"keyword": "loss function", "weight": 1.0, "synonyms": ["cost function"]}
    ]

    answer = "Gradient descent updates parameters iteratively using a step size proportional to the loss function."
    res = KeywordGrader.grade(
        student_answer=answer,
        model_answer="Gradient descent optimizes parameters using a learning rate and loss function.",
        rubric=rubric,
        use_llm_paraphrase=False
    )
    assert res.score == 1.0
    assert res.status == "correct"
    assert res.is_correct is True
    assert len(res.covered_concepts) == 3

def test_keyword_grader_partial_score_band():
    rubric = [
        {"keyword": "backpropagation", "weight": 1.0, "synonyms": []},
        {"keyword": "chain rule", "weight": 1.0, "synonyms": []},
        {"keyword": "partial derivatives", "weight": 1.0, "synonyms": ["gradients"]}
    ]

    # Student only mentions backprop and gradients (2 out of 3 -> score 0.667)
    answer = "Backpropagation calculates gradients through the network."
    res = KeywordGrader.grade(
        student_answer=answer,
        model_answer="Backpropagation applies the chain rule to compute partial derivatives.",
        rubric=rubric,
        use_llm_paraphrase=False
    )
    assert 0.5 <= res.score < 0.8
    assert res.status == "partial"
    assert "chain rule" in res.missed_concepts

def test_keyword_grader_incorrect_score_band():
    rubric = [
        {"keyword": "attention", "weight": 1.0, "synonyms": []},
        {"keyword": "queries", "weight": 1.0, "synonyms": []},
        {"keyword": "keys", "weight": 1.0, "synonyms": []},
        {"keyword": "values", "weight": 1.0, "synonyms": []}
    ]

    # Student writes unrelated sentence (0 out of 4 -> score 0.0)
    answer = "The model uses linear regression with a simple bias term."
    res = KeywordGrader.grade(
        student_answer=answer,
        model_answer="Attention computes scaled dot products between queries, keys, and values.",
        rubric=rubric,
        use_llm_paraphrase=False
    )
    assert res.score < 0.5
    assert res.status == "incorrect"
    assert res.is_correct is False
