import time
import re
from app.audio.text_to_speech import speak
from app.audio.speech_to_text import listen
from app.database import Base, engine, SessionLocal
from app import crud

# Create database tables if they do not exist
print("[DB] Initializing MySQL tables...")
try:
    Base.metadata.create_all(bind=engine)
    print("[DB] Database tables initialized successfully.")
except Exception as e:
    print(f"[DB Warning] Could not initialize database tables: {e}")

questions = [
    "Hello! Welcome to the AI Interview.",
    "What is your name?",
    "What is your age?",
    "What is your qualification?",
    "Do you know Java?",
    "Do you know Spring Boot?"
]

def parse_age(text):
    # Extract the first sequence of digits from the text (e.g. "23 years old" -> 23)
    digits = re.findall(r"\d+", text)
    if digits:
        try:
            return int(digits[0])
        except ValueError:
            return None
    return None

def run_interview():
    answers = {}
    db = SessionLocal()

    # Welcome message
    speak(questions[0])

    # 1. Collect Candidate Details
    print(f"\nAI: {questions[1]}")
    speak(questions[1])
    time.sleep(0.5)
    name_ans = listen()
    answers[questions[1]] = name_ans

    print(f"\nAI: {questions[2]}")
    speak(questions[2])
    time.sleep(0.5)
    age_ans = listen()
    answers[questions[2]] = age_ans
    age_parsed = parse_age(age_ans)

    print(f"\nAI: {questions[3]}")
    speak(questions[3])
    time.sleep(0.5)
    qual_ans = listen()
    answers[questions[3]] = qual_ans

    # Save Candidate and Session to Database
    print("\n[DB] Registering candidate and starting session...")
    candidate = crud.create_candidate(
        db, 
        name=name_ans if name_ans else "Anonymous"
    )
    session = crud.create_interview_session(db, candidate_id=candidate.id)
    print(f"[DB] Candidate Registered ID: {candidate.id} | Session ID: {session.id}")

    # Log initial questions to qa_logs
    crud.create_qa_log(db, session_id=session.id, question=questions[1], answer=name_ans)
    crud.create_qa_log(db, session_id=session.id, question=questions[2], answer=age_ans)
    crud.create_qa_log(db, session_id=session.id, question=questions[3], answer=qual_ans)

    # 2. Ask Technical Questions
    for question in questions[4:]:
        print(f"\nAI: {question}")
        speak(question)
        time.sleep(0.5)
        
        answer = listen()
        answers[question] = answer

        # Log Q&A in real-time
        crud.create_qa_log(db, session_id=session.id, question=question, answer=answer)
        print(f"[DB Logged] Q: '{question}' -> A: '{answer}'")

    # 3. Finish and Update Status
    speak("Thank you. Your interview has been completed.")
    crud.update_session_status(db, session_id=session.id, status="completed")
    db.close()

    print("\n========== Interview Summary (Local) ==========")
    for question, answer in answers.items():
        print(f"{question}")
        print(f"Answer : {answer}")
        print("-------------------------------------")

if __name__ == "__main__":
    run_interview()