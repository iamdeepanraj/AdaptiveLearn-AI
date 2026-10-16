import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.database import SessionLocal
from backend.app.models.course import Course, Topic
from backend.app.models.document import Document, DocumentChunk
from backend.app.models.learner import LearnerMastery

client = TestClient(app)

def get_auth_token():
    login_resp = client.post("/api/auth/login", json={
        "email": "student@adaptivelearn.ai",
        "password": "StudentPass123!"
    })
    return login_resp.json()["access_token"]

def test_get_quick_revise_flashcards_with_citations():
    token = get_auth_token()
    headers = {"Authorization": f"Bearer {token}"}

    # Fetch courses
    courses_resp = client.get("/api/courses", headers=headers)
    assert courses_resp.status_code == 200
    courses = courses_resp.json()
    assert len(courses) >= 1
    course_id = courses[0]["id"]

    # Fetch topics for course
    db = SessionLocal()
    topic = db.query(Topic).filter(Topic.course_id == course_id).first()
    assert topic is not None
    topic_id = topic.id
    db.close()

    # Request flashcards for this topic
    resp = client.get(f"/api/courses/{course_id}/topics/{topic_id}/flashcards", headers=headers)
    assert resp.status_code == 200
    deck = resp.json()
    assert deck["topic_id"] == topic_id
    cards = deck["cards"]

    # Brief requires 6 to 10 cards
    assert 6 <= len(cards) <= 10, f"Expected between 6 and 10 flashcards, got {len(cards)}"

    for card in cards:
        assert card["front"], "Card front concept must be present"
        assert card["back"], "Card back explanation must be present"
        assert card["citation_text"], "Card citation text must be present"
        # Must cite page, slide, timestamp, or document
        has_cite = (
            card.get("page") is not None or
            card.get("slide") is not None or
            card.get("timestamp") is not None or
            ("p." in card["citation_text"].lower()) or
            ("slide" in card["citation_text"].lower()) or
            ("s" in card["citation_text"].lower()) or
            (card.get("document_name") is not None)
        )
        assert has_cite, f"Card missing citation details: {card}"

def test_flashcard_review_updates_bkt_learner_model():
    token = get_auth_token()
    headers = {"Authorization": f"Bearer {token}"}

    courses_resp = client.get("/api/courses", headers=headers)
    course_id = courses_resp.json()[0]["id"]

    db = SessionLocal()
    topic = db.query(Topic).filter(Topic.course_id == course_id).first()
    topic_id = topic.id
    db.close()

    # 1. Review with knew_it = False (negative learning signal)
    review_resp_neg = client.post(
        f"/api/courses/{course_id}/topics/{topic_id}/flashcards/review",
        headers=headers,
        json={
            "card_id": "fc_test_1",
            "topic_id": topic_id,
            "knew_it": False,
            "review_time_sec": 4.5
        }
    )
    assert review_resp_neg.status_code == 200
    neg_data = review_resp_neg.json()
    assert neg_data["success"] is True
    assert neg_data["topic_id"] == topic_id
    assert neg_data["p_mastery_after"] <= neg_data["p_mastery_before"]
    assert neg_data["mastery_delta"] <= 0

    # 2. Review with knew_it = True (positive reinforcement signal)
    review_resp_pos = client.post(
        f"/api/courses/{course_id}/topics/{topic_id}/flashcards/review",
        headers=headers,
        json={
            "card_id": "fc_test_2",
            "topic_id": topic_id,
            "knew_it": True,
            "review_time_sec": 3.0
        }
    )
    assert review_resp_pos.status_code == 200
    pos_data = review_resp_pos.json()
    assert pos_data["success"] is True
    assert pos_data["p_mastery_after"] >= pos_data["p_mastery_before"]
    assert pos_data["mastery_delta"] >= 0
