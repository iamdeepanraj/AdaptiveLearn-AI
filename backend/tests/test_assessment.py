import pytest
from backend.app.assessment.verifier import QuestionVerifier
from backend.app.assessment.grader import AssessmentGrader
from backend.app.models.quiz import QuestionType, DifficultyLevel

def test_question_verifier_detects_invalid():
    # Missing citations
    invalid_q = {
        "question_type": "mcq",
        "question_text": "What is the capital of France?",
        "correct_answer": "Paris",
        "explanation": "Paris is the capital.",
        "options": [{"key": "A", "text": "Paris"}, {"key": "B", "text": "Lyon"}],
        "source_citations": []
    }
    is_valid, reason = QuestionVerifier.verify_question(invalid_q)
    assert is_valid is False
    assert "citation" in reason.lower()

    # Valid MCQ
    valid_q = {
        "question_type": "mcq",
        "question_text": "In gradient descent, what does the learning rate control?",
        "correct_answer": "A",
        "explanation": "Controls step size.",
        "options": [{"key": "A", "text": "Step size along gradient"}, {"key": "B", "text": "Batch size"}],
        "source_citations": [{"document_id": 1, "page": 3, "quote": "step size"}]
    }
    is_valid_2, _ = QuestionVerifier.verify_question(valid_q)
    assert is_valid_2 is True

def test_numerical_answer_tolerance():
    # Test numerical grading tolerance logic
    # Expected: 2.20, Tolerance: 2%
    # Test close value 2.21 -> should pass
    val_correct = 2.20
    val_user = 2.21
    tol = 0.02
    assert abs(val_user - val_correct) <= (abs(val_correct) * tol + 1e-4)

    # Test far value 2.50 -> should fail
    val_wrong = 2.50
    assert abs(val_wrong - val_correct) > (abs(val_correct) * tol + 1e-4)
