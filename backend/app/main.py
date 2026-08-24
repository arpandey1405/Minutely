from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager

from app import config
from app.database import connect_db, disconnect_db
from app.routes import auth_routes, meetings

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Connect to SQLite DB via Prisma
    await connect_db()
    # Ensure upload directory exists
    config.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    yield
    # Shutdown: Disconnect from DB
    await disconnect_db()

app = FastAPI(
    title="AI Meeting Summarizer API",
    description="Automated Speech Recognition & LLM-Powered Meeting Summary Tool Backend",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict to Streamlit's port (e.g., ["http://localhost:8501"])
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount local uploads directory to serve files (needed for local audio playback fallback)
app.mount("/uploads", StaticFiles(directory=str(config.UPLOAD_DIR)), name="uploads")

# Include Routers
app.include_router(auth_routes.router)
app.include_router(meetings.router)

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "database": "connected",
        "cloudinary": "active" if config.CLOUDINARY_CLOUD_NAME else "disabled (local fallback active)",
        "google_oauth": "enabled" if config.GOOGLE_CLIENT_ID else "disabled (email/password only)"
    }

@app.get("/")
async def root():
    return {
        "message": "AI Meeting Summarizer API is running.",
        "version": "1.0.0",
        "health": "/api/health"
    }

