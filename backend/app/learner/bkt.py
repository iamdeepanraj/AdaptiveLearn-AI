"""
Bayesian Knowledge Tracing (BKT) and Understanding Level Engine.

================================================================================
PARTIAL CREDIT & UNDERSTANDING SCORE COMPUTATION RULE DOCUMENTATION:
================================================================================
In traditional Bayesian Knowledge Tracing, observations are strictly binary:
either fully correct (1) or fully incorrect (0). In AdaptiveLearn AI, assessments
support partial credit (e.g., Graded MCQs with partial options scoring 0.50,
keyword short-answer coverage ratios, and numerical tolerance steps).

To bridge continuous partial-credit scores with standard BKT probabilities:
1. BKT Binary Observation Mapping Rule:
   - Any observed score >= 0.75 is treated as a CORRECT observation (Obs = 1).
     This applies Bayes' theorem for positive evidence of knowledge acquisition:
     P(L_t | Correct) = [P(L) * (1 - P(S))] / [P(L) * (1 - P(S)) + (1 - P(L)) * P(G)]
   - Any observed score < 0.75 is treated as an INCORRECT observation (Obs = 0).
     This applies Bayes' theorem for negative evidence / slip / misconception:
     P(L_t | Incorrect) = [P(L) * P(S)] / [P(L) * P(S) + (1 - P(L)) * (1 - P(G))]
   - After the observation update, the learning transition step is applied:
     P(L_{t+1}) = P(L_t | Obs) + (1 - P(L_t | Obs)) * P(T)

2. Running Understanding Score (Recency-Weighted Mean):
   - In parallel with BKT, a direct continuous "Understanding Score" is tracked
     as a recency-weighted mean of all item scores (MCQ 1.0/0.5/0.0, short-answer
     coverage ratios, numerical scores).
   - Higher weights are assigned to recent items:
     For a sequence of scores [s_0, s_1, ..., s_{n-1}] (where s_{n-1} is most recent),
     weight w_i = (i + 1).
     Understanding Score = sum(w_i * s_i) / sum(w_i).
   - This prevents early mistakes from dragging down a student who has now mastered
     the material, while ensuring new mistakes promptly lower the understanding score.

3. Understanding Levels Per Concept:
   - "Strong": Understanding score >= 0.80
   - "Developing": Understanding score in range [0.50, 0.80)
   - "Weak": Understanding score < 0.50
   - "Not assessed": Zero attempts recorded
================================================================================
"""

from typing import Tuple, Dict, Any, List, Union, Optional
import logging
from backend.app.models.learner import MasteryState

logger = logging.getLogger(__name__)

UNDERSTANDING_STRONG = "Strong"
UNDERSTANDING_DEVELOPING = "Developing"
UNDERSTANDING_WEAK = "Weak"
UNDERSTANDING_NOT_ASSESSED = "Not assessed"

PARTIAL_CREDIT_THRESHOLD = 0.75


def get_understanding_level(score: float, total_attempts: int) -> str:
    """
    Categorizes the student's concept understanding level based on score:
    - total_attempts == 0: 'Not assessed'
    - score >= 0.80: 'Strong'
    - 0.50 <= score < 0.80: 'Developing'
    - score < 0.50: 'Weak'
    """
    if total_attempts <= 0:
        return UNDERSTANDING_NOT_ASSESSED
    if score >= 0.80:
        return UNDERSTANDING_STRONG
    elif score >= 0.50:
        return UNDERSTANDING_DEVELOPING
    else:
        return UNDERSTANDING_WEAK


def calculate_running_understanding_score(
    history_scores: List[float],
    new_score: float,
    max_history_len: int = 20
) -> Tuple[float, List[float], str]:
    """
    Appends new_score to history and computes a recency-weighted mean:
    w_i = (i + 1) for i in 0 .. n-1
    Returns (running_score, updated_history, understanding_level)
    """
    updated_history = list(history_scores or [])
    updated_history.append(float(new_score))
    if len(updated_history) > max_history_len:
        updated_history = updated_history[-max_history_len:]

    total_weight = 0.0
    weighted_sum = 0.0
    for idx, score_val in enumerate(updated_history):
        weight = float(idx + 1)
        weighted_sum += weight * score_val
        total_weight += weight

    running_score = round(weighted_sum / max(1e-7, total_weight), 4)
    level = get_understanding_level(running_score, len(updated_history))
    return running_score, updated_history, level


class BayesianKnowledgeTracer:
    """
    Standard Bayesian Knowledge Tracing with partial credit extension.
    """
    DEFAULT_P_INIT = 0.20
    DEFAULT_P_TRANSIT = 0.15
    DEFAULT_P_SLIP = 0.10
    DEFAULT_P_GUESS = 0.20

    @classmethod
    def update_mastery(
        cls,
        p_mastery_prior: float,
        is_correct: Optional[Union[bool, float]] = None,
        observed_score: Optional[Union[bool, float]] = None,
        p_transit: float = DEFAULT_P_TRANSIT,
        p_slip: float = DEFAULT_P_SLIP,
        p_guess: float = DEFAULT_P_GUESS
    ) -> Tuple[float, MasteryState]:
        """
        Updates the probability of knowledge mastery given an observed response.

        Partial credit rule:
        - If boolean: True is correct (Obs=1), False is incorrect (Obs=0).
        - If float/numeric: score >= 0.75 is treated as a CORRECT observation;
          score < 0.75 is treated as an INCORRECT observation.

        Returns:
            (new_p_mastery, new_mastery_state)
        """
        val = is_correct if is_correct is not None else (observed_score if observed_score is not None else False)
        if isinstance(val, bool):
            treated_as_correct = val
        else:
            treated_as_correct = float(val) >= PARTIAL_CREDIT_THRESHOLD


        p_prior = max(0.01, min(0.99, p_mastery_prior))
        p_transit = max(0.01, min(0.50, p_transit))
        p_slip = max(0.01, min(0.30, p_slip))
        p_guess = max(0.01, min(0.30, p_guess))

        # 1. Observation update (Bayes' Rule)
        if treated_as_correct:

            numerator = p_prior * (1.0 - p_slip)
            denominator = numerator + ((1.0 - p_prior) * p_guess)
            p_obs = numerator / max(1e-7, denominator)
        else:
            numerator = p_prior * p_slip
            denominator = numerator + ((1.0 - p_prior) * (1.0 - p_guess))
            p_obs = numerator / max(1e-7, denominator)

        # 2. Learning transition to the next step
        p_next = p_obs + ((1.0 - p_obs) * p_transit)

        # Clamp result
        p_final = round(float(max(0.02, min(0.98, p_next))), 4)
        state = cls.get_mastery_state(p_final)

        return p_final, state


    @staticmethod
    def get_mastery_state(p_mastery: float) -> MasteryState:
        """Classifies mastery probability into interpretable state."""
        if p_mastery < 0.40:
            return MasteryState.NOVICE
        elif p_mastery < 0.70:
            return MasteryState.LEARNING
        elif p_mastery < 0.85:
            return MasteryState.PROFICIENT
        else:
            return MasteryState.MASTERED

    @classmethod
    def get_expected_accuracy(
        cls,
        p_mastery: float,
        p_slip: float = DEFAULT_P_SLIP,
        p_guess: float = DEFAULT_P_GUESS
    ) -> float:
        """
        Expected probability of answering correctly:
        P(Correct) = P(L) * (1 - P(S)) + (1 - P(L)) * P(G)
        """
        p_l = max(0.0, min(1.0, p_mastery))
        return round(float(p_l * (1.0 - p_slip) + (1.0 - p_l) * p_guess), 4)
