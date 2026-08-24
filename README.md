# AI Meeting Summarizer ⚡

An automated transcription, summarization, and action-item extraction platform. It features a highly customized, glassmorphic Streamlit frontend that feels premium, and a backend powered by FastAPI, Prisma ORM (SQLite), Groq (Whisper + LLaMA), and Cloudinary.

## Key Features

- 👤 **Multi-Tenant Authentication**: Sign up and login securely. Includes Sign-In with Google (Google Cloud OAuth 2.0) and fallback Email/Password auth.
- 🎙️ **Sub-Second Transcription**: Powered by Groq's `whisper-large-v3` running on ultra-fast LPUs.
- 🧠 **LLaMA 3.1 Distillation**: Summarizes meetings into concise highlights, key choices made, and distinct action items using JSON structured generation.
- 📋 **Interactive Checklist**: Action items are rendered in a checkable grid showing owners and due dates, updating the database in real-time.
- 📊 **Progress Trackers**: Real-time status polling (Uploaded -> Transcribing -> Summarizing -> Done) with progress metrics.
- 📁 **Cloud Storage & Local Fallback**: Audio files are uploaded to Cloudinary, or stored locally in `backend/uploads/` if credentials are not configured.
- 📥 **Export Reports**: Download compiled summary files directly in Markdown or TXT format.
- 📂 **Meeting History**: Access, delete, and reopen past meeting logs from a persistent list.

---

## Directory Structure

```
Meeting_Summarizer/
├── backend/
│   ├── app/
│   │   ├── routes/
│   │   │   ├── auth_routes.py   # Login, signup, Google OAuth endpoints
│   │   │   └── meetings.py      # Uploads, details, action item updates
│   │   ├── services/
│   │   │   ├── auth.py          # Password hashing, JWTs, Google token verification
│   │   │   ├── storage.py       # Cloudinary and local upload handlers
│   │   │   ├── transcription.py # Groq Whisper API pipeline
│   │   │   └── summarizer.py    # Groq LLaMA JSON mode pipeline
│   │   ├── config.py            # Environment settings loader
│   │   ├── database.py          # Prisma connection controller
│   │   ├── models.py            # Pydantic schema validation
│   │   └── main.py              # FastAPI application entrypoint
│   ├── prisma/
│   │   └── schema.prisma        # Prisma SQLite database models
│   └── requirements.txt         # Backend python packages
├── frontend/
│   ├── app.py                   # Streamlit state router
│   ├── landing.py               # Product marketing overview homepage
│   ├── auth_ui.py               # Glassmorphic Login/Signup forms
│   ├── dashboard.py             # Audio ingestion and workspace dashboard
│   ├── utils.py                 # API clients & custom CSS injector
│   ├── styles.css               # Overriding Streamlit styles (dark mode & glassmorphism)
│   └── requirements.txt         # Frontend python packages
├── run.py                       # Root orchestrator script
├── .env                         # Local environment keys configuration
└── README.md                    # Documentation
```

---

## Technical Stack

- **Frontend**: Streamlit (Python) with custom CSS injection and HTML overlays.
- **Backend API**: FastAPI (Python) with CORS and static files mounting.
- **Database**: Prisma ORM for Python connecting to an SQLite instance (`dev.db`).
- **Inference Hardware**: Groq Cloud API
  - ASR Model: `whisper-large-v3`
  - LLM Model: `llama-3.1-70b-versatile`
- **File Storage**: Cloudinary SDK (with local disk fallback).
- **Authentication**: Google Cloud OAuth 2.0 & JWT with bcrypt hashing.

---

## Setup & Running Guide

### 1. Configure Credentials

Create a copy of the environment template by renaming `.env` or modifying it directly. Add your credentials:

1. **Groq API Key (Required)**: Create a free account at [Groq Console](https://console.groq.com/) and generate a key starting with `gsk_`.
2. **Cloudinary (Optional)**: If you want cloud storage, create a free account at [Cloudinary](https://cloudinary.com/) and copy your Cloud Name, API Key, and API Secret. If left blank, the app will store files in `backend/uploads/`.
3. **Google OAuth Client ID (Optional)**: If you want to use Sign-In with Google, create a Google Cloud Project, set up the OAuth Consent Screen (add `http://localhost:8501/` to authorized redirect URIs), and create a Web Client credential. If left blank, the login page will default to Email/Password authentication.

### 2. Install Dependencies

Open a command line in the project root and install requirements:

```bash
pip install -r backend/requirements.txt -r frontend/requirements.txt
```

### 3. Run the Application

Start both the backend and frontend simultaneously with our root orchestrator script:

```bash
python run.py
```

The script will:
1. Automatically run `prisma db push` to initialize the SQLite database file and generate the python prisma client library if not present.
2. Start the FastAPI backend server on `http://127.0.0.1:8000`.
3. Start the Streamlit frontend client on `http://localhost:8501`.

Open **[http://localhost:8501](http://localhost:8501)** in your browser to view the application!
