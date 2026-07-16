from pydantic import BaseModel, EmailStr
from typing import List, Optional

class UserResponse(BaseModel):
    id: int
    email: str
    name: str
    role: str
    current_capacity: int
    preferences_submitted: bool

    class Config:
        from_attributes = True

class CourseResponse(BaseModel):
    id: int
    code: str
    name: str
    credits: float
    slots_required: int

    class Config:
        from_attributes = True

class PreferenceSubmit(BaseModel):
    course_id: int
    preference_value: Optional[int] = None  # 1-5, or None if skipped
