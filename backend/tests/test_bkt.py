import pytest
from backend.app.learner_model.bkt import BayesianKnowledgeTracer
from backend.app.learner_model.spaced_repetition import SpacedRepetitionScheduler
from backend.app.models.learner import MasteryState

def test_bkt_correct_answer_increases_mastery():
    prior = 0.30
    new_p, state = BayesianKnowledgeTracer.update_mastery(
        p_mastery_prior=prior,
        is_correct=True,
        p_transit=0.15,
        p_slip=0.10,
        p_guess=0.20
    )
    assert new_p > prior
    assert state in [MasteryState.LEARNING, MasteryState.PROFICIENT]

def test_bkt_incorrect_answer_decreases_mastery():
    prior = 0.70
    new_p, state = BayesianKnowledgeTracer.update_mastery(
        p_mastery_prior=prior,
        is_correct=False,
        p_transit=0.15,
        p_slip=0.10,
        p_guess=0.20
    )
    assert new_p < prior

def test_bkt_consecutive_correct_reaches_mastery():
    p = 0.20
    for _ in range(8):
        p, state = BayesianKnowledgeTracer.update_mastery(p_mastery_prior=p, is_correct=True)
    assert p >= 0.85
    assert state == MasteryState.MASTERED

def test_spaced_repetition_scheduler_intervals():
    # First correct
    due_1, reps_1, int_1, _ = SpacedRepetitionScheduler.calculate_next_review(is_correct=True, repetition_count=0)
    assert reps_1 == 1
    assert int_1 == 1.0

    # Second correct
    due_2, reps_2, int_2, _ = SpacedRepetitionScheduler.calculate_next_review(is_correct=True, repetition_count=1)
    assert reps_2 == 2
    assert int_2 == 3.0

    # Third correct
    due_3, reps_3, int_3, _ = SpacedRepetitionScheduler.calculate_next_review(is_correct=True, repetition_count=2, interval_days=3.0)
    assert reps_3 == 3
    assert int_3 > 3.0

    # Failure resets interval
    due_fail, reps_fail, int_fail, _ = SpacedRepetitionScheduler.calculate_next_review(is_correct=False, repetition_count=3)
    assert reps_fail == 0
    assert int_fail == 1.0
