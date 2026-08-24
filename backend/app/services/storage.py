import os
import shutil
from pathlib import Path
from typing import Tuple
import cloudinary
import cloudinary.uploader

from app import config

# Initialize Cloudinary if credentials are provided
if (config.CLOUDINARY_CLOUD_NAME and 
    config.CLOUDINARY_API_KEY and 
    config.CLOUDINARY_API_SECRET):
    cloudinary.config(
        cloud_name=config.CLOUDINARY_CLOUD_NAME,
        api_key=config.CLOUDINARY_API_KEY,
        api_secret=config.CLOUDINARY_API_SECRET,
        secure=True
    )
    CLOUDINARY_ACTIVE = True
else:
    CLOUDINARY_ACTIVE = False

def save_uploaded_file(file_content: bytes, filename: str, meeting_id: str) -> Tuple[str, bool]:
    """
    Saves file. If Cloudinary credentials exist, uploads to Cloudinary.
    Otherwise, saves to local storage directory.
    
    Returns:
        Tuple[str, bool]: (url_or_path, is_cloudinary_bool)
    """
    # Create unique name to avoid conflicts
    ext = Path(filename).suffix
    unique_filename = f"{meeting_id}{ext}"
    local_path = config.UPLOAD_DIR / unique_filename
    
    # Save file locally first (needed either way)
    with open(local_path, "wb") as buffer:
        buffer.write(file_content)
        
    if CLOUDINARY_ACTIVE:
        try:
            # Upload to Cloudinary under 'meeting_summarizer' folder
            result = cloudinary.uploader.upload(
                str(local_path),
                resource_type="video", # Audio files are uploaded as video resource type in Cloudinary
                folder="meeting_summarizer",
                public_id=meeting_id
            )
            
            # Clean up local file after upload
            if local_path.exists():
                os.remove(local_path)
                
            return result.get("secure_url"), True
        except Exception as e:
            print(f"Failed to upload to Cloudinary: {e}. Falling back to local storage.")
            # Fall back to local URL
    
    # Local fallback URL
    local_url = f"http://{config.HOST}:{config.PORT}/uploads/{unique_filename}"
    return local_url, False

def delete_stored_file(audio_url: str, meeting_id: str):
    """
    Deletes meeting audio file from local disk or Cloudinary.
    """
    if CLOUDINARY_ACTIVE and "cloudinary.com" in audio_url:
        try:
            # Delete from Cloudinary
            cloudinary.uploader.destroy(f"meeting_summarizer/{meeting_id}", resource_type="video")
        except Exception as e:
            print(f"Failed to delete Cloudinary file: {e}")
    else:
        # Delete local file if it exists
        filename = audio_url.split("/")[-1]
        local_path = config.UPLOAD_DIR / filename
        if local_path.exists():
            try:
                os.remove(local_path)
            except Exception as e:
                print(f"Failed to delete local file: {e}")
