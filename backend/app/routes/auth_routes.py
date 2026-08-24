from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from datetime import timedelta
from typing import Optional
from pydantic import BaseModel

from app.database import db
from prisma.models import User
from app import models
from app.services import auth

router = APIRouter(prefix="/api/auth", tags=["Authentication"])
security = HTTPBearer()

# Pydantic schema for Google login request
class GoogleLoginRequest(BaseModel):
    code: Optional[str] = None
    id_token: Optional[str] = None
    redirect_uri: Optional[str] = None

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> User:
    token = credentials.credentials
    payload = auth.verify_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user_id = payload["sub"]
    user = await db.user.find_unique(where={"id": user_id})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="User account not found"
        )
    return user

@router.post("/signup", response_model=models.TokenOut)
async def signup(user_data: models.UserSignUp):
    # Check if user already exists
    existing_user = await db.user.find_unique(where={"email": user_data.email})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists."
        )
    
    # Hash password and create user
    hashed_pwd = auth.hash_password(user_data.password)
    user = await db.user.create(
        data={
            "email": user_data.email,
            "password": hashed_pwd,
            "name": user_data.name or user_data.email.split("@")[0]
        }
    )
    
    # Create JWT Access token
    access_token = auth.create_access_token(data={"sub": user.id, "email": user.email})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }

@router.post("/login", response_model=models.TokenOut)
async def login(credentials: models.UserLogin):
    # Find user by email
    user = await db.user.find_unique(where={"email": credentials.email})
    if not user or not user.password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )
    
    # Verify password
    if not auth.verify_password(credentials.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )
        
    # Create JWT Access token
    access_token = auth.create_access_token(data={"sub": user.id, "email": user.email})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }

@router.post("/google", response_model=models.TokenOut)
async def google_login(req: GoogleLoginRequest):
    id_token_str = req.id_token
    
    # If code is supplied, exchange code for ID token
    if req.code:
        if not req.redirect_uri:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="redirect_uri is required when exchanging an authorization code."
            )
        token_response = await auth.exchange_google_code(req.code, req.redirect_uri)
        if not token_response or "id_token" not in token_response:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to exchange authorization code with Google."
            )
        id_token_str = token_response["id_token"]
        
    if not id_token_str:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google ID token or OAuth Code must be provided."
        )
        
    # Verify the ID token
    google_claims = auth.verify_google_id_token(id_token_str)
    if not google_claims:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google ID token validation failed."
        )
        
    email = google_claims["email"]
    google_id = google_claims["google_id"]
    name = google_claims["name"]
    picture = google_claims["picture"]
    
    # Look for existing user
    user = await db.user.find_unique(where={"googleId": google_id})
    if not user:
        # Fall back to finding by email
        user = await db.user.find_unique(where={"email": email})
        if user:
            # Link existing account to Google ID
            user = await db.user.update(
                where={"id": user.id},
                data={"googleId": google_id, "avatarUrl": picture}
            )
        else:
            # Create new user
            user = await db.user.create(
                data={
                    "email": email,
                    "googleId": google_id,
                    "name": name or email.split("@")[0],
                    "avatarUrl": picture
                }
            )
            
    # Generate JWT
    access_token = auth.create_access_token(data={"sub": user.id, "email": user.email})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }

@router.get("/me", response_model=models.UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user
