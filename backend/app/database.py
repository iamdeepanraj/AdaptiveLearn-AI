import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from backend.app.config import settings

logger = logging.getLogger(__name__)

Base = declarative_base()

# Attempt to connect to configured DATABASE_URL, with seamless SQLite fallback if unavailable
database_url = settings.DATABASE_URL

try:
    if database_url.startswith("sqlite"):
        engine = create_engine(database_url, connect_args={"check_same_thread": False})
    else:
        engine = create_engine(database_url, pool_pre_ping=True)
    # Quick probe
    with engine.connect() as conn:
        logger.info(f"Connected to database successfully: {database_url.split('@')[-1] if '@' in database_url else database_url}")
except Exception as e:
    logger.warning(f"Failed to connect to primary DB ({database_url}): {e}. Falling back to SQLite local db.")
    database_url = "sqlite:///./adaptivelearn.db"
    engine = create_engine(database_url, connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    from backend.app.models import user, course, document, chat, quiz, learner
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables verified/created successfully.")
