import pytest
from backend.app.learner.bkt import (
    BayesianKnowledgeTracer,
    calculate_running_understanding_score,
    get_understanding_level,
    UNDERSTANDING_STRONG,
    UNDERSTANDING_DEVELOPING,
    UNDERSTANDING_WEAK,
    UNDERSTANDING_NOT_ASSESSED,
)
from backend.app.models.learner import MasteryState

def test_understanding_level_thresholds():
    assert get_understanding_level(0.9, 0) == UNDERSTANDING_NOT_ASSESSED
    assert get_understanding_level(0.95, 3) == UNDERSTANDING_STRONG
    assert get_understanding_level(0.80, 5) == UNDERSTANDING_STRONG
    assert get_understanding_level(0.75, 4) == UNDERSTANDING_DEVELOPING
    assert get_understanding_level(0.50, 2) == UNDERSTANDING_DEVELOPING
    assert get_understanding_level(0.49, 3) == UNDERSTANDING_WEAK
    assert get_understanding_level(0.10, 1) == UNDERSTANDING_WEAK

def test_running_understanding_score_recency_weighting():
    # Sequence of scores: early 0.0, but recent 1.0, 1.0
    history = [0.0]
    score, hist, level = calculate_running_understanding_score(history, 1.0)
    # w_0 = 1, s_0 = 0.0; w_1 = 2, s_1 = 1.0 -> sum = 2.0 / 3.0 = 0.6667
    assert round(score, 2) == 0.67
    assert level == UNDERSTANDING_DEVELOPING

    # Another 1.0 -> w_2 = 3, s_2 = 1.0 -> (0 + 2 + 3) / 6 = 5/6 = 0.8333
    score2, hist2, level2 = calculate_running_understanding_score(hist, 1.0)
    assert round(score2, 2) == 0.83
    assert level2 == UNDERSTANDING_STRONG

def test_bkt_partial_credit_rule():
    prior = 0.50
    # Score 0.80 >= 0.75 -> treated as correct observation
    p_high, state_high = BayesianKnowledgeTracer.update_mastery(
        p_mastery_prior=prior,
        observed_score=0.80
    )
    assert p_high > prior, "Score >= 0.75 should increase mastery"

    # Score 0.50 < 0.75 -> treated as incorrect observation
    p_low, state_low = BayesianKnowledgeTracer.update_mastery(
        p_mastery_prior=prior,
        observed_score=0.50
    )
    assert p_low < prior, "Score < 0.75 should decrease mastery"
