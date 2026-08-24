import json
from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Form, BackgroundTasks
from typing import List, Optional
import uuid

from app.database import db
from prisma.models import User
from app import models
from app.routes.auth_routes import get_current_user
from app.services import storage, transcription, summarizer

router = APIRouter(prefix="/api/meetings", tags=["Meetings"])

async def process_meeting_pipeline(meeting_id: str, audio_path: str, custom_api_key: Optional[str] = None):
    """
    Background worker pipeline: Transcribe audio -> Summarize transcript -> Populate SQLite db tables.
    """
    try:
        # 1. Update status to transcribing
        await db.meeting.update(
            where={"id": meeting_id},
            data={"status": "transcribing"}
        )
        
        # 2. Run ASR
        transcript_text = await transcription.transcribe_audio(audio_path, custom_api_key)
        
        await db.transcript.create(
            data={
                "meetingId": meeting_id,
                "text": transcript_text
            }
        )
        
        # 3. Update status to summarizing
        await db.meeting.update(
            where={"id": meeting_id},
            data={"status": "summarizing"}
        )
        
        # 4. Run LLM Summarization
        summary_result = await summarizer.summarize_transcript(transcript_text, custom_api_key)
        
        # 5. Save Summary & Decisions
        await db.summary.create(
            data={
                "meetingId": meeting_id,
                "summaryText": summary_result.get("summary", "No summary generated."),
                "decisions": json.dumps(summary_result.get("decisions", []))
            }
        )
        
        # 6. Save Action Items
        for item in summary_result.get("action_items", []):
            await db.actionitem.create(
                data={
                    "meetingId": meeting_id,
                    "task": item.get("task", ""),
                    "owner": item.get("owner"),
                    "dueDate": item.get("due_date"),
                    "isCompleted": False
                }
            )
            
        # 7. Complete!
        await db.meeting.update(
            where={"id": meeting_id},
            data={"status": "done"}
        )
        
    except Exception as e:
        print(f"Background pipeline failed for meeting {meeting_id}: {e}")
        await db.meeting.update(
            where={"id": meeting_id},
            data={"status": "failed"}
        )

@router.post("/upload", response_model=models.MeetingOut)
async def upload_meeting(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    custom_groq_api_key: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user)
):
    # Validate file extension
    ext = file.filename.split(".")[-1].lower() if "." in file.filename else ""
    if ext not in ["mp3", "wav", "m4a", "webm", "ogg"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported audio format. Supported: mp3, wav, m4a, webm, ogg."
        )
        
    # Generate meeting ID
    meeting_id = str(uuid.uuid4())
    meeting_title = title or file.filename.rsplit(".", 1)[0]
    
    # Read file content
    try:
        file_bytes = await file.read()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to read uploaded file: {e}"
        )
        
    # Save audio (Cloudinary or local fallback)
    audio_path_or_url, is_cloudinary = storage.save_uploaded_file(
        file_bytes, 
        file.filename, 
        meeting_id
    )
    
    # Create meeting record
    try:
        meeting = await db.meeting.create(
            data={
                "id": meeting_id,
                "userId": current_user.id,
                "title": meeting_title,
                "audioUrl": audio_path_or_url,
                "status": "uploaded"
            }
        )
    except Exception as e:
        # Clean up stored file if db insert fails
        storage.delete_stored_file(audio_path_or_url, meeting_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {e}"
        )
        
    # Queue background processing task
    background_tasks.add_task(
        process_meeting_pipeline,
        meeting_id,
        audio_path_or_url,
        custom_groq_api_key
    )
    
    return meeting

@router.get("", response_model=List[models.MeetingOut])
async def list_meetings(current_user: User = Depends(get_current_user)):
    # List all meetings of the current user, newest first
    meetings = await db.meeting.find_many(
        where={"userId": current_user.id},
        order={"createdAt": "desc"}
    )
    return meetings

@router.get("/{meeting_id}", response_model=models.MeetingDetailOut)
async def get_meeting_details(meeting_id: str, current_user: User = Depends(get_current_user)):
    # Find meeting and verify ownership
    meeting = await db.meeting.find_first(
        where={
            "id": meeting_id,
            "userId": current_user.id
        },
        include={
            "transcript": True,
            "summary": True,
            "actionItems": True
        }
    )
    
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting not found or you do not have permission to view it."
        )
        
    # Adapt database model to Pydantic schema
    # Decisions are stored as JSON string in db, parse it back to array
    summary_data = None
    if meeting.summary:
        try:
            decisions_list = json.loads(meeting.summary.decisions)
        except Exception:
            decisions_list = []
            
        summary_data = models.SummaryOut(
            summaryText=meeting.summary.summaryText,
            decisions=decisions_list,
            createdAt=meeting.summary.createdAt
        )
        
    action_items_list = []
    if meeting.actionItems:
        for item in meeting.actionItems:
            action_items_list.append(models.ActionItemOut.from_orm(item))
            
    transcript_data = None
    if meeting.transcript:
        transcript_data = models.TranscriptOut.from_orm(meeting.transcript)
        
    return models.MeetingDetailOut(
        id=meeting.id,
        title=meeting.title,
        audioUrl=meeting.audioUrl,
        status=meeting.status,
        createdAt=meeting.createdAt,
        transcript=transcript_data,
        summary=summary_data,
        actionItems=action_items_list
    )

@router.get("/{meeting_id}/status")
async def get_meeting_status(meeting_id: str, current_user: User = Depends(get_current_user)):
    meeting = await db.meeting.find_first(
        where={
            "id": meeting_id,
            "userId": current_user.id
        }
    )
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting not found."
        )
    return {"id": meeting.id, "status": meeting.status}

@router.delete("/{meeting_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_meeting(meeting_id: str, current_user: User = Depends(get_current_user)):
    meeting = await db.meeting.find_first(
        where={
            "id": meeting_id,
            "userId": current_user.id
        }
    )
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting not found or access denied."
        )
        
    # Delete file from storage
    if meeting.audioUrl:
        storage.delete_stored_file(meeting.audioUrl, meeting.id)
        
    # Delete from database (Cascade handles related records)
    await db.meeting.delete(where={"id": meeting_id})
    return None

@router.put("/{meeting_id}/action-items/{item_id}", response_model=models.ActionItemOut)
async def update_action_item(
    meeting_id: str,
    item_id: str,
    updates: models.ActionItemUpdate,
    current_user: User = Depends(get_current_user)
):
    # Verify meeting belongs to user
    meeting = await db.meeting.find_first(
        where={
            "id": meeting_id,
            "userId": current_user.id
        }
    )
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting not found or access denied."
        )
        
    # Verify action item belongs to meeting
    action_item = await db.actionitem.find_first(
        where={
            "id": item_id,
            "meetingId": meeting_id
        }
    )
    if not action_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Action item not found in this meeting."
        )
        
    # Update status
    updated_item = await db.actionitem.update(
        where={"id": item_id},
        data={"isCompleted": updates.isCompleted}
    )
    
    return updated_item
