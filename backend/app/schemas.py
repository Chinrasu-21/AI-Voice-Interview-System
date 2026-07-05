from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict

# Q&A Log Schemas
class QuestionAnswerLogBase(BaseModel):
    question: str
    answer: Optional[str] = None

class QuestionAnswerLogCreate(QuestionAnswerLogBase):
    session_id: int

class QuestionAnswerLog(QuestionAnswerLogBase):
    id: int
    session_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Interview Session Schemas
class InterviewSessionBase(BaseModel):
    status: Optional[str] = "started"

class InterviewSessionCreate(BaseModel):
    candidate_id: int

class InterviewSession(InterviewSessionBase):
    id: int
    candidate_id: int
    created_at: datetime
    logs: List[QuestionAnswerLog] = []

    model_config = ConfigDict(from_attributes=True)


# Candidate Schemas
class CandidateBase(BaseModel):
    name: str
    phone: Optional[str] = None

class CandidateCreate(CandidateBase):
    pass

class Candidate(CandidateBase):
    id: int
    created_at: datetime
    sessions: List[InterviewSession] = []

    model_config = ConfigDict(from_attributes=True)
