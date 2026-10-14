from datetime import datetime
from pydantic import BaseModel, EmailStr, ConfigDict
from backend.app.models.user import UserRole

class UserRegister(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: UserRole = UserRole.STUDENT

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    email: str
    full_name: str
    role: str

class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    full_name: str
    role: str
    is_active: bool
    created_at: datetime
