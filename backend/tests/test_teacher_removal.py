import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.auth import create_access_token
from backend.app.models.user import User, UserRole
from backend.app.models.course import Course
from backend.app.database import SessionLocal

client = TestClient(app)

def test_teacher_router_not_mounted():
    # Verify teacher routes return 404
    resp = client.get("/api/teacher/classes")
    assert resp.status_code in [404, 405]
    resp2 = client.get("/api/teacher/analytics")
    assert resp2.status_code in [404, 405]

def test_course_data_isolation_between_students():
    db = SessionLocal()
    try:
        # Create user A
        user_a = db.query(User).filter(User.email == "student_a@test.com").first()
        if not user_a:
            user_a = User(email="student_a@test.com", full_name="Student A", hashed_password="pw", role=UserRole.STUDENT)
            db.add(user_a)
            db.commit()
            db.refresh(user_a)

        # Create user B
        user_b = db.query(User).filter(User.email == "student_b@test.com").first()
        if not user_b:
            user_b = User(email="student_b@test.com", full_name="Student B", hashed_password="pw", role=UserRole.STUDENT)
            db.add(user_b)
            db.commit()
            db.refresh(user_b)

        # Create course owned by User A
        course_a = db.query(Course).filter(Course.code == "CS_OWNED_A").first()
        if not course_a:
            course_a = Course(code="CS_OWNED_A", title="Course Owned By A", created_by_id=user_a.id)
            db.add(course_a)
            db.commit()
            db.refresh(course_a)

        # User B authenticates
        token_b = create_access_token({"sub": str(user_b.id)})
        headers_b = {"Authorization": f"Bearer {token_b}"}


        # User B queries their courses -> Course A must NOT appear
        resp = client.get("/api/courses", headers=headers_b)
        assert resp.status_code == 200
        course_ids = [c["id"] for c in resp.json()]
        assert course_a.id not in course_ids

        # User B tries to access Course A directly -> 404 forbidden
        resp_detail = client.get(f"/api/courses/{course_a.id}", headers=headers_b)
        assert resp_detail.status_code == 404
    finally:
        db.close()
