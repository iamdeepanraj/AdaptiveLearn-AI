from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models.user import User
from backend.app.auth import get_current_user
from backend.app.services.understanding_service import UnderstandingService

router = APIRouter(prefix="/understanding", tags=["Understanding & Mastery Overview"])

@router.get("", response_model=Dict[str, Any])
def get_understanding(
    course_id: Optional[int] = Query(None, description="Optional Course ID to filter understanding metrics"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns the student's complete understanding profile:
    - Overall understanding level ('Strong', 'Developing', 'Weak', 'Not assessed')
    - Per-topic breakdown with scores, levels, attempts, and historical trends
    - Top 3 weak concepts with detected misconceptions, evidence questions/answers, and grounded source links
    - Strengths
    - Honest plain-language summary derived exclusively from recorded numbers
    - Remediation history
    """
    return UnderstandingService.get_understanding_overview(
        db=db,
        user_id=current_user.id,
        course_id=course_id
    )
