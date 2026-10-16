import logging
from backend.app.database import SessionLocal
from backend.app.models.chat import Conversation, ChatMessage

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("cleanup_chat_sessions")

def cleanup_duplicate_and_eval_sessions():
    """
    One-off cleanup script:
    1. Removes all evaluation / test run conversations (e.g. 'population of Madagasc',
       'quantum topological surface codes', 'honest abstention').
    2. De-duplicates repeated conversations with the same title for the same user and course,
       keeping only the newest one.
    """
    db = SessionLocal()
    deleted_eval_count = 0
    deleted_dupe_count = 0

    try:
        # Step 1: Remove evaluation-generated sessions
        eval_patterns = [
            "population of madagasc",
            "quantum topological",
            "honest abstention",
            "surface codes"
        ]

        all_convos = db.query(Conversation).order_by(Conversation.created_at.desc()).all()
        logger.info(f"Initial total conversations in DB: {len(all_convos)}")

        remaining_convos = []
        for c in all_convos:
            title_lower = (c.title or "").lower()
            # Check if any messages in conversation match eval patterns
            has_eval_msg = False
            for m in c.messages:
                content_lower = (m.content or "").lower()
                if any(p in content_lower for p in eval_patterns):
                    has_eval_msg = True
                    break

            if any(p in title_lower for p in eval_patterns) or has_eval_msg:
                db.delete(c)
                deleted_eval_count += 1
            else:
                remaining_convos.append(c)

        db.commit()
        logger.info(f"Deleted {deleted_eval_count} evaluation-generated sessions.")

        # Step 2: De-duplicate duplicate sessions (keep newest per (user_id, course_id, normalized_title))
        seen_keys = set()
        for c in remaining_convos:
            norm_title = (c.title or "").strip().lower()
            key = (c.user_id, c.course_id, norm_title)
            if key in seen_keys:
                db.delete(c)
                deleted_dupe_count += 1
            else:
                seen_keys.add(key)

        db.commit()
        logger.info(f"Deleted {deleted_dupe_count} duplicate sessions.")

        final_count = db.query(Conversation).count()
        logger.info(f"Cleanup finished successfully. Remaining distinct student sessions: {final_count}")

    except Exception as e:
        db.rollback()
        logger.error(f"Error during cleanup: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    cleanup_duplicate_and_eval_sessions()
