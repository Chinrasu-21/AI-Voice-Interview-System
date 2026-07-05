from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import router as api_router
from app.database import Base, engine, SessionLocal
from app import models, crud

# Create MySQL tables if not exist at API startup
try:
    Base.metadata.create_all(bind=engine)
    print("[DB] MySQL tables initialized successfully at FastAPI startup.")
    
    # Pre-populate default candidates if database is empty
    db = SessionLocal()
    try:
        if db.query(models.Candidate).count() == 0:
            crud.create_candidate(db, name="Perumal", phone="9876543210")
            crud.create_candidate(db, name="Chinrasu", phone="9876543211")
            crud.create_candidate(db, name="Arun", phone="9876543212")
            crud.create_candidate(db, name="Vignesh", phone="9876543213")
            crud.create_candidate(db, name="Hari", phone="9876543214")
            print("[DB] Pre-populated MySQL database with default candidates.")
    finally:
        db.close()
except Exception as e:
    print(f"[DB Warning] Could not initialize database or candidates: {e}")

app = FastAPI(
    title="AI Voice Interview Automation System API",
    description="Backend API for candidate registration, interview session management, and voice transcription.",
    version="1.0.0"
)

# Enable CORS (Cross-Origin Resource Sharing) middleware
# This allows any frontend dashboard (e.g. React at http://localhost:5173 or similar) to communicate with this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict this to specific frontend origins in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register our API routes router
app.include_router(api_router, prefix="/api")

@app.get("/", tags=["General"])
def home():
    return {
        "message": "AI Voice Interview Automation API is Running!",
        "docs": "/docs"
    }