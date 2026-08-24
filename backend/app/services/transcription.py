import os
from pathlib import Path
import httpx
from groq import Groq

from app import config

async def transcribe_audio(audio_url_or_path: str, custom_api_key: str = None) -> str:
    """
    Transcribes audio using Groq's whisper-large-v3 ASR engine.
    Supports local file paths and remote URLs (like Cloudinary).
    
    Args:
        audio_url_or_path (str): Path to local file or URL to remote audio.
        custom_api_key (str): Optional runtime Groq API Key to override env config.
    """
    api_key = custom_api_key or config.GROQ_API_KEY
    if not api_key:
        raise ValueError("Groq API Key is missing. Please set it in your .env or settings panel.")
        
    client = Groq(api_key=api_key)
    temp_file_path = None
    
    try:
        # Check if remote URL
        if audio_url_or_path.startswith("http://") or audio_url_or_path.startswith("https://"):
            # Download audio to a temp local file for uploading to Groq
            temp_filename = f"temp_transcribe_{os.getpid()}_{Path(audio_url_or_path).name}"
            # Ensure it has a correct audio extension if missing
            if not Path(temp_filename).suffix:
                temp_filename += ".mp3"
                
            temp_file_path = config.UPLOAD_DIR / temp_filename
            
            async with httpx.AsyncClient(timeout=60.0) as http_client:
                response = await http_client.get(audio_url_or_path)
                if response.status_code != 200:
                    raise Exception(f"Failed to download audio from URL. HTTP Code: {response.status_code}")
                with open(temp_file_path, "wb") as f:
                    f.write(response.content)
            
            file_to_send = temp_file_path
        else:
            file_to_send = Path(audio_url_or_path)
            if not file_to_send.exists():
                raise FileNotFoundError(f"Local audio file not found: {audio_url_or_path}")

        # Check file size (Groq limit: 25MB)
        file_size_mb = os.path.getsize(file_to_send) / (1024 * 1024)
        if file_size_mb > 25.0:
            raise ValueError(f"Audio file size ({file_size_mb:.2f}MB) exceeds Groq's 25MB API limit. Please upload a shorter or more compressed file (e.g., MP3).")

        # Call Groq Whisper API
        with open(file_to_send, "rb") as file:
            transcription = client.audio.transcriptions.create(
                file=(file_to_send.name, file.read()),
                model="whisper-large-v3",
                response_format="json" # Groq returns structured json with text
            )
            
        transcript_text = transcription.text if hasattr(transcription, "text") else transcription.get("text", "")
        if not transcript_text:
            raise Exception("ASR returned an empty transcript.")
            
        return transcript_text
        
    finally:
        # Clean up temporary file if downloaded
        if temp_file_path and temp_file_path.exists():
            try:
                os.remove(temp_file_path)
            except Exception as e:
                print(f"Error cleaning up temp audio file: {e}")
