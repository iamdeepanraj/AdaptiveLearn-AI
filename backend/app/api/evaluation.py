from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models.user import User
from backend.app.auth import get_current_user
from backend.app.evaluation.runner import EvaluationRunner

router = APIRouter(prefix="/evaluation", tags=["Evaluation & Simulation"])

@router.get("/benchmark")
def run_benchmark(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Runs the formal RAGAS/DeepEval-compatible benchmark on the gold test cases,
    measuring faithfulness, answer relevancy, context precision/recall,
    citation validity, and abstention quality. Available to course owners.
    """
    return EvaluationRunner.run_benchmark(db=db)

@router.get("/simulation")
def run_student_simulation(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Runs an automated multi-session adaptive assessment simulation across
    Novice, Intermediate, and Advanced student archetypes to measure
    Bayesian Knowledge Tracing mastery trajectories and question repetition rates.
    Available to course owners.
    """
    return EvaluationRunner.run_student_simulation(db=db)
