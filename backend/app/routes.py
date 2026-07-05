import os
import shutil
import tempfile
import requests
from typing import List
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Response, Request
from sqlalchemy.orm import Session
from app import crud, schemas, models
from app.database import get_db
from app.audio.speech_to_text import model as whisper_model
from twilio.rest import Client
from twilio.twiml.voice_response import VoiceResponse

# Force reloading environment variables dynamically
dotenv_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
if os.path.exists(dotenv_path):
    load_dotenv(dotenv_path, override=True)
else:
    load_dotenv(override=True)

router = APIRouter()

INTERVIEW_QUESTIONS = [
    "What is your name?",
    "What is your age?",
    "What is your qualification?",
    "Do you know Java?",
    "Do you know Spring Boot?"
]

@router.post("/candidates", response_model=schemas.Candidate)
def register_candidate(candidate: schemas.CandidateCreate, db: Session = Depends(get_db)):
    return crud.create_candidate(db, name=candidate.name, phone=candidate.phone)

@router.get("/candidates", response_model=List[schemas.Candidate])
def get_candidates(db: Session = Depends(get_db)):
    return db.query(models.Candidate).all()

@router.post("/interviews/start", response_model=schemas.InterviewSession)
def start_interview(payload: schemas.InterviewSessionCreate, db: Session = Depends(get_db)):
    # Verify candidate exists
    candidate = crud.get_candidate(db, candidate_id=payload.candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return crud.create_interview_session(db, candidate_id=payload.candidate_id)

@router.post("/interviews/{session_id}/upload-answer")
def upload_answer(
    session_id: int,
    question: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    # Verify session exists
    session = crud.get_interview_session(db, session_id=session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Interview session not found")

    # Save uploaded file to temp file
    suffix = os.path.splitext(file.filename)[1] if file.filename else ".wav"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
        temp_path = temp_file.name
        try:
            shutil.copyfileobj(file.file, temp_file)
        finally:
            file.file.close()

    # Transcribe temp file using Whisper
    try:
        segments, info = whisper_model.transcribe(
            temp_path,
            language="en",
            beam_size=5
        )
        transcription = " ".join([s.text for s in segments]).strip()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")
    finally:
        # Delete temp file
        if os.path.exists(temp_path):
            os.remove(temp_path)

    # Save Q&A log to database
    qa_log = crud.create_qa_log(db, session_id=session_id, question=question, answer=transcription)

    return {
        "id": qa_log.id,
        "session_id": session_id,
        "question": question,
        "transcription": transcription
    }

@router.get("/interviews/{session_id}/summary", response_model=schemas.InterviewSession)
def get_interview_summary(session_id: int, db: Session = Depends(get_db)):
    session = crud.get_interview_session(db, session_id=session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Interview session not found")
    return session

@router.post("/interviews/{session_id}/call")
def trigger_twilio_call(session_id: int, db: Session = Depends(get_db)):
    session = crud.get_interview_session(db, session_id=session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Interview session not found")
    
    candidate = crud.get_candidate(db, candidate_id=session.candidate_id)
    if not candidate or not candidate.phone:
        raise HTTPException(status_code=400, detail="Candidate phone number not found")

    twilio_sid = os.getenv("TWILIO_ACCOUNT_SID")
    twilio_token = os.getenv("TWILIO_AUTH_TOKEN")
    twilio_phone = os.getenv("TWILIO_PHONE_NUMBER")
    ngrok_url = os.getenv("NGROK_URL")

    if not all([twilio_sid, twilio_token, twilio_phone, ngrok_url]):
        raise HTTPException(status_code=500, detail="Twilio/ngrok credentials are not fully configured in backend/.env")

    try:
        client = Client(twilio_sid, twilio_token)
        call = client.calls.create(
            to=candidate.phone,
            from_=twilio_phone,
            url=f"{ngrok_url}/api/interviews/{session_id}/twiml/start"
        )
        return {"message": "Call initiated successfully", "call_sid": call.sid}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Twilio call failed to start: {str(e)}")

@router.post("/interviews/{session_id}/twiml/start")
def twiml_start(session_id: int):
    response = VoiceResponse()
    response.say("Hello. Welcome to the AI Interview. This interview will take approximately five minutes. Let's begin.", voice="Polly.Amy")
    response.say(INTERVIEW_QUESTIONS[0], voice="Polly.Amy")
    
    ngrok_url = os.getenv("NGROK_URL")
    response.record(
        action=f"{ngrok_url}/api/interviews/{session_id}/twiml/answer?q_idx=0",
        maxLength=20,
        playBeep=True,
        timeout=3
    )
    return Response(content=str(response), media_type="application/xml")

@router.post("/interviews/{session_id}/twiml/answer")
async def twiml_answer(
    session_id: int,
    request: Request,
    q_idx: int,
    db: Session = Depends(get_db)
):
    form_data = await request.form()
    recording_url = form_data.get("RecordingUrl")

    response = VoiceResponse()

    if not recording_url:
        transcription = "(No response detected)"
    else:
        try:
            # Twilio recordings require basic auth for download
            twilio_sid = os.getenv("TWILIO_ACCOUNT_SID")
            twilio_token = os.getenv("TWILIO_AUTH_TOKEN")
            
            recording_res = requests.get(recording_url, auth=(twilio_sid, twilio_token))
            recording_res.raise_for_status()
            
            with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_file:
                temp_path = temp_file.name
                temp_file.write(recording_res.content)
            
            segments, info = whisper_model.transcribe(temp_path, language="en", beam_size=5)
            transcription = " ".join([s.text for s in segments]).strip()
            
            if os.path.exists(temp_path):
                os.remove(temp_path)
        except Exception as e:
            print(f"[Transcription Warning] Twilio audio transcription failed: {e}")
            transcription = "(Transcription error)"

    current_q = INTERVIEW_QUESTIONS[q_idx]
    crud.create_qa_log(db, session_id=session_id, question=current_q, answer=transcription)

    next_idx = q_idx + 1
    if next_idx < len(INTERVIEW_QUESTIONS):
        next_q = INTERVIEW_QUESTIONS[next_idx]
        response.say(next_q, voice="Polly.Amy")
        ngrok_url = os.getenv("NGROK_URL")
        response.record(
            action=f"{ngrok_url}/api/interviews/{session_id}/twiml/answer?q_idx={next_idx}",
            maxLength=20,
            playBeep=True,
            timeout=3
        )
    else:
        response.say("Thank you. Your interview has been completed.", voice="Polly.Amy")
        response.hangup()
        crud.update_session_status(db, session_id=session_id, status="completed")

    return Response(content=str(response), media_type="application/xml")

@router.get("/test-env")
def test_env():
    return {
        "TWILIO_ACCOUNT_SID": os.getenv("TWILIO_ACCOUNT_SID"),
        "TWILIO_AUTH_TOKEN": os.getenv("TWILIO_AUTH_TOKEN"),
        "TWILIO_PHONE_NUMBER": os.getenv("TWILIO_PHONE_NUMBER"),
        "NGROK_URL": os.getenv("NGROK_URL")
    }

@router.delete("/candidates/{candidate_id}")
def delete_candidate(candidate_id: int, db: Session = Depends(get_db)):
    success = crud.delete_candidate(db, candidate_id=candidate_id)
    if not success:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return {"message": "Candidate deleted successfully"}
