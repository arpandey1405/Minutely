# API Documentation

The Minutely backend is a RESTful API powered by **FastAPI** and **Uvicorn**.

* **Base URL**: `http://127.0.0.1:8000`
* **Content Type**: `application/json` (except for file uploads which use `multipart/form-data`)

---

## Authentication & Authorization

All secure endpoints require a JSON Web Token (JWT) passed in the `Authorization` header:
```http
Authorization: Bearer <your_jwt_access_token>
```

---

## 1. Authentication Endpoints

### Signup
Creates a new email/password user account.
* **Method**: `POST`
* **Path**: `/api/auth/signup`
* **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "securepassword123",
    "name": "Arpan Dey"
  }
  ```
* **Response (200 OK)**:
  ```json
  {
    "access_token": "eyJhbGciOi...",
    "token_type": "bearer",
    "user": {
      "id": "a6b8c0d2-...",
      "email": "user@example.com",
      "name": "Arpan Dey",
      "avatarUrl": null
    }
  }
  ```

### Login
Authenticates credentials and returns a JWT access token.
* **Method**: `POST`
* **Path**: `/api/auth/login`
* **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "securepassword123"
  }
  ```
* **Response (200 OK)**:
  Same structure as Signup.

### Google OAuth Login
Exchanges a Google Authorization Code for a local Minutely access token.
* **Method**: `POST`
* **Path**: `/api/auth/google`
* **Request Body**:
  ```json
  {
    "code": "4/0ATsMZqAl...",
    "redirect_uri": "https://minutely-frontend.vercel.app"
  }
  ```
* **Response (200 OK)**:
  Same structure as Signup (returns Google profile image URL inside `avatarUrl`).

### Get Profile
Retrieves credentials of the currently logged-in user.
* **Method**: `GET`
* **Path**: `/api/auth/me`
* **Headers**: `Authorization: Bearer <token>`
* **Response (200 OK)**:
  ```json
  {
    "id": "a6b8c0d2-...",
    "email": "user@example.com",
    "name": "Arpan Dey",
    "avatarUrl": "https://lh3.googleusercontent.com/..."
  }
  ```

---

## 2. Meetings Endpoints

### Upload Meeting Recording
Uploads an audio file and triggers background transcription/summarization.
* **Method**: `POST`
* **Path**: `/api/meetings/upload`
* **Headers**: `Authorization: Bearer <token>`
* **Request Body**: `multipart/form-data`
  * `file`: Audio File (`.mp3`, `.wav`, `.m4a`, `.webm`, max 25MB)
  * `title` (Optional): String meeting name
* **Response (200 OK)**:
  ```json
  {
    "id": "9f0e1d2c-...",
    "title": "Q3 Design Sync",
    "status": "uploaded",
    "createdAt": "2026-08-24T16:20:00Z"
  }
  ```

### List Meetings
Lists past and processing meetings created by the logged-in user.
* **Method**: `GET`
* **Path**: `/api/meetings`
* **Headers**: `Authorization: Bearer <token>`
* **Response (200 OK)**:
  ```json
  [
    {
      "id": "9f0e1d2c-...",
      "title": "Q3 Design Sync",
      "status": "done",
      "createdAt": "2026-08-24T16:20:00Z"
    }
  ]
  ```

### Get Meeting Details
Returns the full parsed transcript, summary abstract, key decisions, and action items checklist.
* **Method**: `GET`
* **Path**: `/api/meetings/{meeting_id}`
* **Headers**: `Authorization: Bearer <token>`
* **Response (200 OK)**:
  ```json
  {
    "id": "9f0e1d2c-...",
    "title": "Q3 Design Sync",
    "status": "done",
    "audioUrl": "https://res.cloudinary.com/...",
    "createdAt": "2026-08-24T16:20:00Z",
    "transcript": {
      "text": "Hello team, today we need to align on Q3 design goals..."
    },
    "summary": {
      "summaryText": "The team aligned on core deliverables for the Q3 roadmap.",
      "decisions": [
        "Finalized Q3 design milestone cutoff for September 15th."
      ]
    },
    "actionItems": [
      {
        "id": "c1d2e3f4-...",
        "task": "Create high-fidelity mockups",
        "owner": "Sarah",
        "dueDate": "2026-09-01",
        "isCompleted": false
      }
    ]
  }
  ```

### Delete Meeting
Removes a meeting record, database entities, and local files (cascades automatically).
* **Method**: `DELETE`
* **Path**: `/api/meetings/{meeting_id}`
* **Headers**: `Authorization: Bearer <token>`
* **Response (200 OK)**:
  ```json
  {
    "message": "Meeting deleted successfully."
  }
  ```

---

## 3. Action Items Endpoints

### Toggle Action Item Status
Syncs checkbox completion changes to the database.
* **Method**: `PUT`
* **Path**: `/api/meetings/action-items/{item_id}`
* **Headers**: `Authorization: Bearer <token>`
* **Request Body**:
  ```json
  {
    "isCompleted": true
  }
  ```
* **Response (200 OK)**:
  ```json
  {
    "id": "c1d2e3f4-...",
    "task": "Create high-fidelity mockups",
    "owner": "Sarah",
    "dueDate": "2026-09-01",
    "isCompleted": true
  }
  ```

---

## 4. System Endpoints

### Health Check
* **Method**: `GET`
* **Path**: `/api/health`
* **Response (200 OK)**:
  ```json
  {
    "status": "healthy",
    "database": "connected",
    "cloudinary": "active",
    "google_oauth": "enabled"
  }
  ```
