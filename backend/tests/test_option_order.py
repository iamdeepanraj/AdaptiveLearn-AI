import pytest
from backend.app.models.quiz import Question, QuestionType, DifficultyLevel
from backend.app.assessment.generator import QuestionGenerator

def test_option_order_ascending_letters():
    """Verify that options are always given ascending keys A, B, C, D from top to bottom."""
    raw_options = [
        {"key": "X", "text": "Distractor 1", "label": "wrong", "score": 0.0},
        {"key": "Y", "text": "Correct explanation", "label": "correct", "score": 1.0},
        {"key": "Z", "text": "Partial explanation", "label": "partial", "score": 0.5},
        {"key": "W", "text": "Distractor 2", "label": "wrong", "score": 0.0},
    ]

    rekeyed, correct_key = QuestionGenerator.shuffle_and_rekey_options(raw_options, seed=42)
    keys = [opt["key"] for opt in rekeyed]
    assert keys == ["A", "B", "C", "D"], f"Keys must be ascending A-D from top to bottom, got: {keys}"
    assert correct_key in ["A", "B", "C", "D"]
    # The option with label 'correct' must match correct_key
    corr_opt = next(opt for opt in rekeyed if opt["key"] == correct_key)
    assert corr_opt["label"] == "correct"

def test_option_order_stable_on_reload():
    """Verify that formatting a student question preserves the stored order stably."""
    stored_options = [
        {"key": "A", "text": "Alpha concept"},
        {"key": "B", "text": "Beta concept"},
        {"key": "C", "text": "Gamma concept"},
        {"key": "D", "text": "Delta concept"},
    ]
    q = Question(
        id=101,
        topic_id=1,
        question_type=QuestionType.MCQ,
        difficulty=DifficultyLevel.MEDIUM,
        question_text="Sample MCQ question?",
        correct_answer="B",
        options=stored_options
    )

    # First load
    view1 = QuestionGenerator.format_student_safe_question(q)
    keys1 = [opt.key for opt in (view1.options or [])]
    texts1 = [opt.text for opt in (view1.options or [])]

    # Reload
    view2 = QuestionGenerator.format_student_safe_question(q)
    keys2 = [opt.key for opt in (view2.options or [])]
    texts2 = [opt.text for opt in (view2.options or [])]

    assert keys1 == ["A", "B", "C", "D"]
    assert keys1 == keys2
    assert texts1 == texts2

def test_option_labels_and_scores_hidden_before_answering():
    """Verify that correct/partial/wrong labels and scores are NEVER sent to the student view."""
    stored_options = [
        {"key": "A", "text": "Wrong choice", "label": "wrong", "score": 0.0, "rationale": "Wrong"},
        {"key": "B", "text": "Correct choice", "label": "correct", "score": 1.0, "rationale": "Right"},
        {"key": "C", "text": "Partial choice", "label": "partial", "score": 0.5, "rationale": "Partial"},
        {"key": "D", "text": "Misconception", "label": "wrong", "score": 0.0, "rationale": "Trap"},
    ]
    q = Question(
        id=102,
        topic_id=1,
        question_type=QuestionType.MCQ,
        difficulty=DifficultyLevel.HARD,
        question_text="Secret evaluation question?",
        correct_answer="B",
        options=stored_options
    )

    safe_view = QuestionGenerator.format_student_safe_question(q)
    view_dict = safe_view.model_dump()

    assert "correct_answer" not in view_dict
    assert "explanation" not in view_dict

    for opt in view_dict.get("options", []):
        assert "label" not in opt
        assert "score" not in opt
        assert "rationale" not in opt
        assert "misconception" not in opt
        assert "key" in opt
        assert "text" in opt
