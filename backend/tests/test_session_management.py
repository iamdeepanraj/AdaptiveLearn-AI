import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from backend.app.main import app
from backend.app.database import get_db
from backend.app.models.user import User
from backend.app.models.course import Course, Topic
from backend.app.models.chat import Conversation, ChatMessage
from backend.app.services.tutor_service import TutorService

client = TestClient(app)

def get_auth_token():
    login_resp = client.post("/api/auth/login", json={
        "email": "student@adaptivelearn.ai",
        "password": "StudentPass123!"
    })
    return login_resp.json()["access_token"]

def test_multiple_messages_in_conversation_do_not_duplicate_sessions():
    token = get_auth_token()
    headers = {"Authorization": f"Bearer {token}"}

    # Get course
    courses_resp = client.get("/api/courses", headers=headers)
    course_id = courses_resp.json()[0]["id"]

    # 1. Send first message without conversation_id -> creates a conversation
    msg1_resp = client.post("/api/chat", headers=headers, json={
        "course_id": course_id,
        "message": "What is the main topic of this course?",
        "conversation_id": None
    })
    assert msg1_resp.status_code == 200
    msg1_data = msg1_resp.json()
    conv_id = msg1_data["conversation_id"]
    assert conv_id is not None and conv_id > 0

    # Count conversations for student
    convos_before = client.get(f"/api/chat/conversations?course_id={course_id}", headers=headers).json()
    convo_count_before = len(convos_before)

    # 2. Send second message with conversation_id -> reuses conversation
    msg2_resp = client.post("/api/chat", headers=headers, json={
        "course_id": course_id,
        "message": "Can you elaborate further?",
        "conversation_id": conv_id
    })
    assert msg2_resp.status_code == 200
    assert msg2_resp.json()["conversation_id"] == conv_id

    # 3. Send third message with same conversation_id
    msg3_resp = client.post("/api/chat", headers=headers, json={
        "course_id": course_id,
        "message": "Give one more concrete example.",
        "conversation_id": conv_id
    })
    assert msg3_resp.status_code == 200
    assert msg3_resp.json()["conversation_id"] == conv_id

    # Count conversations again: should NOT have increased
    convos_after = client.get(f"/api/chat/conversations?course_id={course_id}", headers=headers).json()
    assert len(convos_after) == convo_count_before

    # Verify message list in this conversation
    detail_resp = client.get(f"/api/chat/conversations/{conv_id}", headers=headers)
    assert detail_resp.status_code == 200
    conv_detail = detail_resp.json()
    # At least 3 student messages + 3 assistant responses = 6 messages
    assert len(conv_detail["messages"]) >= 6

def test_save_to_db_false_prevents_eval_sessions_in_db():
    from backend.app.database import SessionLocal
    db: Session = SessionLocal()
    try:
        student = db.query(User).filter(User.email == "student@adaptivelearn.ai").first()
        course = db.query(Course).first()

        count_convos_before = db.query(Conversation).filter(
            Conversation.user_id == student.id,
            Conversation.course_id == course.id
        ).count()
        count_msgs_before = db.query(ChatMessage).count()

        # Call TutorService with save_to_db=False (as evaluation runner does)
        ans = TutorService.answer_student_question(
            db=db,
            user_id=student.id,
            course_id=course.id,
            message_text="Evaluation probe question?",
            conversation_id=None,
            save_to_db=False
        )

        assert ans is not None
        assert ans.content is not None
        # Verify no new conversation or message was persisted
        count_convos_after = db.query(Conversation).filter(
            Conversation.user_id == student.id,
            Conversation.course_id == course.id
        ).count()
        count_msgs_after = db.query(ChatMessage).count()

        assert count_convos_after == count_convos_before
        assert count_msgs_after == count_msgs_before
    finally:
        db.close()

def test_session_rename_and_delete():
    token = get_auth_token()
    headers = {"Authorization": f"Bearer {token}"}

    courses_resp = client.get("/api/courses", headers=headers)
    course_id = courses_resp.json()[0]["id"]

    # Create a conversation
    msg_resp = client.post("/api/chat", headers=headers, json={
        "course_id": course_id,
        "message": "Temporary session to test rename and delete",
        "conversation_id": None
    })
    conv_id = msg_resp.json()["conversation_id"]

    # 1. Rename conversation
    rename_resp = client.patch(f"/api/chat/conversations/{conv_id}", headers=headers, json={
        "title": "Renamed Study Session"
    })
    assert rename_resp.status_code == 200
    assert rename_resp.json()["title"] == "Renamed Study Session"

    # Verify detail reflects updated title
    detail_resp = client.get(f"/api/chat/conversations/{conv_id}", headers=headers)
    assert detail_resp.status_code == 200
    assert detail_resp.json()["title"] == "Renamed Study Session"

    # 2. Delete conversation
    del_resp = client.delete(f"/api/chat/conversations/{conv_id}", headers=headers)
    assert del_resp.status_code == 200
    assert del_resp.json()["status"] == "deleted"

    # 3. Verify conversation is no longer found (404)
    get_del_resp = client.get(f"/api/chat/conversations/{conv_id}", headers=headers)
    assert get_del_resp.status_code == 404
