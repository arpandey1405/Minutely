# System Design Document

This document outlines the high-level architecture, pipeline flows, and technical choices implemented in the **Minutely** system.

---

## 1. System Architecture Overview

Minutely follows a modular multi-tier architecture:

```
                  +-----------------------------------+
                  |        Vite React Client          |
                  |  - Interactive Dashboard UI       |
                  |  - Audio Ingest & Playback        |
                  |  - Real-time Polling & Checklist  |
                  +-----------------+-----------------+
                                    | HTTP / JSON Requests
                                    v
                  +-----------------------------------+
                  |         FastAPI Gateway           |
                  |  - Route Handling & Middleware    |
                  |  - Token & Google Auth Filters    |
                  |  - Async Background Task Spawner  |
                  +--------+-----------------+--------+
                           |                 |
         Local File system |                 | Prisma ORM
                           v                 v
            +--------------+---+    +--------+--------+
            |  backend/uploads |    |   SQLite db     |
            |  (Local Storage) |    |   (dev.db)      |
            +------------------+    +-----------------+
                                             |
                         External API Integrations (HTTPS)
                                             |
                   +-------------------------+-------------------------+
                   |                         |                         |
                   v                         v                         v
        +----------+----------+   +----------+----------+   +----------+----------+
        |   Cloudinary CDN    |   |  Groq Whisper LPU   |   |   Groq LLM LPU      |
        |  (Cloud File Store) |   |  (Speech-to-Text)   |   |  (JSON summarizer)  |
        +---------------------+   +---------------------+   +---------------------+
```

---

## 2. Ingestion & Summarization Sequence

When a user uploads a meeting recording, the process operates **asynchronously** to prevent locking the HTTP connection. The request immediately returns a status of `uploaded` and processes the file in the background:

```
[React Client]          [FastAPI Endpoint]       [Storage Service]       [Groq Whisper]       [Groq LLM]        [SQLite (Prisma)]
      |                          |                       |                      |                  |                    |
      |-- POST /upload --------->|                       |                      |                  |                    |
      |   (Audio File)           |-- Ingest local/cloud->|                      |                  |                    |
      |                          |   (Saves raw audio)   |                      |                  |                    |
      |<-- Returns 200 OK -------|                       |                      |                  |                    |
      |    (Status: 'uploaded')  |                       |                      |                  |                    |
      |                          |-- Spawn Background Task ------------------------------------------------------------>|
      |                          |                                              |                  |                    |
      |-- Get Status (Polling)-->|                                              |                  |                    |
      |<-- status: 'uploaded' ---|                                              |                  |                    |
      |                          |-- Send Audio -------------------------------->|                  |                    |
      |                          |<-- Returns Transcript text ------------------|                  |                    |
      |                          |                                              |                  |                    |
      |-- Get Status (Polling)-->|                                              |                  |                    |
      |<-- status: 'transcribing'|                                              |                  |                    |
      |                          |-- Send Transcript & JSON Prompt -------------------------------->|                    |
      |                          |<-- Returns Summary JSON -----------------------------------------|                    |
      |                          |                                              |                  |                    |
      |-- Get Status (Polling)-->|                                              |                  |                    |
      |<-- status: 'summarizing'-|                                              |                  |                    |
      |                          |-- Parse & Write Results ------------------------------------------------------------>|
      |                          |   (Transcript, Summary, ActionItems)         |                  |                    |
      |                          |                                              |                  |                    |
      |-- Get Status (Polling)-->|                                              |                  |                    |
      |<-- status: 'done' -------|                                              |                  |                    |
      |                          |                                              |                  |                    |
      v                          v                                              v                  v                    v
```

---

## 3. Key Design Decisions

### A. Asynchronous Task Execution (FastAPI `BackgroundTasks`)
Rather than forcing the client to wait for translation APIs (which can take 10–20 seconds), FastAPI uses standard python `BackgroundTasks`. 
* The backend saves the file, commits a pending `Meeting` entry to SQLite with status `uploaded`, and returns immediately.
* A background thread handles the slow external network calls sequentially: `Upload (Cloudinary) -> Transcribe (Groq Whisper) -> Summarize (Groq LLM)`.
* If any step fails, the meeting status in the DB is set to `failed`, which is picked up by the client during polling.

### B. LLM JSON Mode for Parsing Action Items
To prevent the LLM from outputting conversational filler (such as *"Here is your summary:"*) which breaks parsers, we use **Groq JSON Mode** (`response_format={"type": "json_object"}`).
* The prompt mandates a strict JSON schema structure containing keys for `summary`, `decisions`, and `action_items`.
* The `groq/compound` model enforces valid JSON. The backend parses this output and inserts it directly into the `Summary`, `Decision`, and `ActionItem` database tables.

### C. Graceful Fallbacks for External Assets
The system operates under zero-lock credentials:
* **Audio Storage**: If Cloudinary environment variables are missing, the system automatically falls back to storing audio locally in `backend/uploads/` and serves files locally through a FastAPI `StaticFiles` mount (`/uploads`).
* **Profile Avatars**: If a user's Google OAuth profile photo fails to load (due to university proxy blocks or missing values), the React frontend catches the image loader error and falls back to a locally rendered SVG vector silhouette.

### D. Single-Viewport Desktop Locking
For desktop layouts, the main dashboard interface height is restricted to `100vh` with `overflow: hidden`, and content scrollable regions are bound internally. This prevents double scrollbars on the browser level, providing a clean SaaS workflow.
