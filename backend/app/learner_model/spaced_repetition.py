from datetime import datetime, timedelta
from typing import Tuple, Optional
import math
import logging

logger = logging.getLogger(__name__)

class SpacedRepetitionScheduler:
    """
    Computes optimal revision intervals using an adaptive half-life memory model.
    Encourages timely review before memory decay drops below retrieval threshold.
    """
    @staticmethod
    def calculate_next_review(
        is_correct: bool,
        repetition_count: int,
        easiness_factor: float = 2.5,
        interval_days: float = 1.0
    ) -> Tuple[datetime, int, float, float]:
        """
        Calculates:
        (next_review_due_at, updated_repetitions, updated_interval_days, updated_easiness)
        """
        now = datetime.utcnow()

        if is_correct:
            if repetition_count == 0:
                new_interval = 1.0
            elif repetition_count == 1:
                new_interval = 3.0
            else:
                new_interval = interval_days * easiness_factor

            new_repetitions = repetition_count + 1
            # Adjust easiness factor slightly
            new_easiness = max(1.3, min(3.0, easiness_factor + 0.1))
        else:
            # Memory slip: reset repetition counter and shorten interval
            new_repetitions = 0
            new_interval = 1.0
            new_easiness = max(1.3, easiness_factor - 0.2)

        next_due = now + timedelta(days=float(new_interval))
        return next_due, new_repetitions, round(new_interval, 2), round(new_easiness, 2)

    @staticmethod
    def is_review_due(next_review_due_at: Optional[datetime]) -> bool:
        if not next_review_due_at:
            return False
        return datetime.utcnow() >= next_review_due_at
