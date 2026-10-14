import os
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.app.config import settings
from backend.app.database import init_db, SessionLocal
from backend.app.services.seed_data import seed_database
from backend.app.api.auth import router as auth_router
from backend.app.api.courses import router as courses_router
from backend.app.api.documents import router as documents_router
from backend.app.api.chat import router as chat_router
from backend.app.api.quizzes import router as quizzes_router
from backend.app.api.analytics import router as analytics_router
from backend.app.api.evaluation import router as evaluation_router
from backend.app.api.understanding import router as understanding_router
from backend.app.api.remediation import router as remediation_router
from backend.app.ai.llm import get_llm


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="AdaptiveLearn AI — Personalized Tutoring with Bayesian Adaptive Learning & Source-Grounded RAG",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Routers
api_prefix = "/api"
app.include_router(auth_router, prefix=api_prefix)
app.include_router(courses_router, prefix=api_prefix)
app.include_router(documents_router, prefix=api_prefix)
app.include_router(chat_router, prefix=api_prefix)
app.include_router(quizzes_router, prefix=api_prefix)
app.include_router(analytics_router, prefix=api_prefix)
app.include_router(evaluation_router, prefix=api_prefix)
app.include_router(understanding_router, prefix=api_prefix)
app.include_router(remediation_router, prefix=api_prefix)


# Mount Uploads directory for source preview files
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

@app.on_event("startup")
def on_startup():
    logger.info("Initializing database and verifying tables...")
    init_db()
    db = SessionLocal()
    try:
        seed_database(db)
    except Exception as e:
        logger.error(f"Error seeding database: {e}", exc_info=True)
    finally:
        db.close()
    logger.info("AdaptiveLearn AI backend ready.")

@app.get("/health")
@app.get("/api/health")
def health_check():
    llm = get_llm()
    configured, reason = llm.check_health()
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "llm": {
            "provider": settings.LLM_PROVIDER,
            "model": settings.OLLAMA_MODEL if settings.LLM_PROVIDER == "ollama" else settings.ANTHROPIC_MODEL,
            "configured": configured,
            "reason": reason
        },
        "llm_provider": settings.LLM_PROVIDER,
        "embedding_provider": settings.EMBEDDING_PROVIDER
    }

@app.get("/")
def root():
    return {
        "message": "Welcome to AdaptiveLearn AI Backend API",
        "documentation": "/docs"
    }
