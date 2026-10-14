import pytest
from backend.app.assessment.expr import SafeExpressionEvaluator

def test_safe_expression_evaluator_basic_math():
    assert SafeExpressionEvaluator.evaluate("2 + 3 * 4") == 14.0
    assert SafeExpressionEvaluator.evaluate("10 / 2 - 1") == 4.0
    assert SafeExpressionEvaluator.evaluate("2 ** 3") == 8.0

def test_safe_expression_evaluator_with_params():
    res = SafeExpressionEvaluator.evaluate(
        "0.5 * mass * velocity**2",
        {"mass": 4.0, "velocity": 3.0}
    )
    assert res == 18.0

def test_safe_expression_evaluator_math_functions():
    res = SafeExpressionEvaluator.evaluate("sqrt(16) + abs(-5)")
    assert res == 9.0

def test_safe_expression_evaluator_verify_match():
    valid, recomputed, reason = SafeExpressionEvaluator.verify_numerical_problem(
        expression="w * x + b",
        params={"w": 2.5, "x": 4.0, "b": 1.2},
        stated_answer=11.2,
        tolerance=0.01
    )
    assert valid is True
    assert recomputed == 11.2

def test_safe_expression_evaluator_rejects_incorrect_answer():
    valid, recomputed, reason = SafeExpressionEvaluator.verify_numerical_problem(
        expression="w * x + b",
        params={"w": 2.5, "x": 4.0, "b": 1.2},
        stated_answer=15.0,  # Incorrect!
        tolerance=0.01
    )
    assert valid is False
    assert "Mismatch" in reason

def test_safe_expression_evaluator_rejects_unsafe_code():
    with pytest.raises(ValueError):
        SafeExpressionEvaluator.evaluate("__import__('os').system('ls')")
