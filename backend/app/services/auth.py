import httpx
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from google.oauth2 import id_token
from google.auth.transport import requests
from typing import Optional

from app import config

# Password hashing configuration
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception:
        return False

# JWT Token configuration
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=config.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, config.JWT_SECRET, algorithm=config.ALGORITHM)
    return encoded_jwt

def verify_access_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, config.JWT_SECRET, algorithms=[config.ALGORITHM])
        return payload
    except JWTError:
        return None

# Google OAuth verification
async def exchange_google_code(code: str, redirect_uri: str) -> Optional[dict]:
    """
    Exchanges OAuth authorization code for Google ID and Access tokens.
    """
    if not config.GOOGLE_CLIENT_ID or not config.GOOGLE_CLIENT_SECRET:
        raise ValueError("Google Client ID or Secret is not configured.")
        
    token_url = "https://oauth2.googleapis.com/token"
    payload = {
        "code": code,
        "client_id": config.GOOGLE_CLIENT_ID,
        "client_secret": config.GOOGLE_CLIENT_SECRET,
        "redirect_uri": redirect_uri,
        "grant_type": "authorization_code"
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(token_url, data=payload)
        if response.status_code != 200:
            print(f"[!] Google OAuth token exchange failed (Status {response.status_code}): {response.text}")
            return None
        return response.json()

def verify_google_id_token(id_token_str: str) -> Optional[dict]:
    """
    Verifies a Google ID token and returns claims (email, name, picture).
    """
    try:
        # Verify the token against Google (with 30s clock skew tolerance)
        idinfo = id_token.verify_oauth2_token(
            id_token_str, 
            requests.Request(), 
            config.GOOGLE_CLIENT_ID,
            clock_skew_in_seconds=30
        )
        
        # Verify the issuer
        if idinfo["iss"] not in ["accounts.google.com", "https://accounts.google.com"]:
            raise ValueError("Wrong issuer.")
            
        return {
            "google_id": idinfo["sub"],
            "email": idinfo["email"],
            "name": idinfo.get("name"),
            "picture": idinfo.get("picture")
        }
    except Exception as e:
        print(f"[!] Error verifying Google ID token: {e}")
        import traceback
        traceback.print_exc()
        return None

