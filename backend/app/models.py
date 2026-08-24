from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime

# User Schemas
class UserSignUp(BaseModel):
    email: EmailStr
    password: str
    name: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class GoogleAuthRequest(BaseModel):
    id_token: str
    name: Optional[str] = None
    email: Optional[str] = None

class UserOut(BaseModel):
    id: str
    email: str
    name: Optional[str] = None
    avatarUrl: Optional[str] = None
    createdAt: datetime

    class Config:
        from_attributes = True

class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut

# Action Item Schemas
class ActionItemOut(BaseModel):
    id: str
    task: str
    owner: Optional[str] = None
    dueDate: Optional[str] = None
    isCompleted: bool
    createdAt: datetime

    class Config:
        from_attributes = True

class ActionItemUpdate(BaseModel):
    isCompleted: bool

# Transcript Schemas
class TranscriptOut(BaseModel):
    text: str
    createdAt: datetime

    class Config:
        from_attributes = True

# Summary Schemas
class SummaryOut(BaseModel):
    summaryText: str
    decisions: List[str]
    createdAt: datetime

    class Config:
        from_attributes = True

# Meeting Schemas
class MeetingOut(BaseModel):
    id: str
    title: str
    audioUrl: Optional[str] = None
    status: str
    createdAt: datetime

    class Config:
        from_attributes = True

class MeetingDetailOut(BaseModel):
    id: str
    title: str
    audioUrl: Optional[str] = None
    status: str
    createdAt: datetime
    transcript: Optional[TranscriptOut] = None
    summary: Optional[SummaryOut] = None
    actionItems: List[ActionItemOut] = []

    class Config:
        from_attributes = True
