from sqlalchemy.orm import Session
from app import models, schemas

# Candidate CRUD operations
def get_candidate(db: Session, candidate_id: int):
    return db.query(models.Candidate).filter(models.Candidate.id == candidate_id).first()

def create_candidate(db: Session, name: str, phone: str = None):
    db_candidate = models.Candidate(
        name=name,
        phone=phone
    )
    db.add(db_candidate)
    db.commit()
    db.refresh(db_candidate)
    return db_candidate


# Interview Session CRUD operations
def get_interview_session(db: Session, session_id: int):
    return db.query(models.InterviewSession).filter(models.InterviewSession.id == session_id).first()

def create_interview_session(db: Session, candidate_id: int):
    db_session = models.InterviewSession(candidate_id=candidate_id, status="started")
    db.add(db_session)
    db.commit()
    db.refresh(db_session)
    return db_session

def update_session_status(db: Session, session_id: int, status: str):
    db_session = db.query(models.InterviewSession).filter(models.InterviewSession.id == session_id).first()
    if db_session:
        db_session.status = status
        db.commit()
        db.refresh(db_session)
    return db_session


# Q&A Log CRUD operations
def create_qa_log(db: Session, session_id: int, question: str, answer: str = None):
    db_log = models.QuestionAnswerLog(
        session_id=session_id,
        question=question,
        answer=answer
    )
    db.add(db_log)
    db.commit()
    db.refresh(db_log)
    return db_log

def get_session_logs(db: Session, session_id: int):
    return db.query(models.QuestionAnswerLog).filter(models.QuestionAnswerLog.session_id == session_id).all()

def delete_candidate(db: Session, candidate_id: int):
    db_candidate = db.query(models.Candidate).filter(models.Candidate.id == candidate_id).first()
    if db_candidate:
        db.delete(db_candidate)
        db.commit()
        return True
    return False
