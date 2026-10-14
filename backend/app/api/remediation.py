from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models.user import User
from backend.app.auth import get_current_user
from backend.app.services.remediation_service import RemediationService

router = APIRouter(prefix="/remediation", tags=["Concept Remediation Loop"])

class RemediationStartRequest(BaseModel):
    topic_id: int
    round_number: int = 1

class RemediationAnswerItem(BaseModel):
    question_id: int
    answer: str

class RemediationSubmitRequest(BaseModel):
    session_id: int
    answers: List[RemediationAnswerItem]

@router.post("/start", response_model=Dict[str, Any])
def start_remediation(
    req: RemediationStartRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Starts or continues a targeted remediation session for a weak concept:
    1. Re-explains from material in simpler words, incorporating weak prerequisites.
    2. Provides one fresh worked example.
    3. Directly targets the identified misconception.
    4. Serves 2-3 fresh non-repeating check questions.
    """
    try:
        return RemediationService.start_or_get_session(
            db=db,
            user_id=current_user.id,
            topic_id=req.topic_id,
            round_number=req.round_number
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/submit", response_model=Dict[str, Any])
def submit_remediation(
    req: RemediationSubmitRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Evaluates check questions:
    - If score >= 0.8: marks concept improving, updates BKT, and schedules spaced repetition review.
    - If score < 0.8: tries a different explanation style (analogy, step-by-step) up to 3 rounds, then provides specific reading passages.
    """
    try:
        answers_dict = [{"question_id": a.question_id, "answer": a.answer} for a in req.answers]
        return RemediationService.submit_answers(
            db=db,
            user_id=current_user.id,
            session_id=req.session_id,
            answers=answers_dict
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
