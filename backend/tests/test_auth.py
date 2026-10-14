import pytest
from backend.app.auth import hash_password, verify_password, create_access_token
import jwt
from backend.app.config import settings

def test_password_hashing():
    pwd = "SecureStudentPass2026!"
    hashed = hash_password(pwd)
    assert hashed != pwd
    assert verify_password(pwd, hashed) is True
    assert verify_password("WrongPassword!", hashed) is False

def test_jwt_token_creation_and_payload():
    payload = {"sub": "42", "email": "test@adaptivelearn.ai", "role": "student"}
    token = create_access_token(payload)
    decoded = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    assert decoded["sub"] == "42"
    assert decoded["email"] == "test@adaptivelearn.ai"
    assert decoded["role"] == "student"
    assert "exp" in decoded
