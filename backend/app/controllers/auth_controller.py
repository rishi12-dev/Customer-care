from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session
from app.api.dependencies import current_user, request_ip
from app.config.database import get_db
from app.config.settings import get_settings
from app.models.entities import AuditAction, User
from app.schemas.dto import LoginRequest, RefreshRequest, TokenPair, UserRead
from app.services.audit_service import audit
from app.utils.security import create_access_token, create_refresh_token, decode_token, new_csrf_token, verify_password


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenPair)
def login(payload: LoginRequest, response: Response, request: Request, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email, User.is_active.is_(True)).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    csrf = new_csrf_token()
    response.set_cookie("csrf_token", csrf, httponly=False, secure=True, samesite="strict", max_age=1800)
    audit(db, user, AuditAction.login, request_ip(request), {})
    db.commit()
    return TokenPair(access_token=create_access_token(str(user.id), user.role.value), refresh_token=create_refresh_token(str(user.id), user.role.value), csrf_token=csrf)


@router.post("/refresh", response_model=TokenPair)
def refresh(payload: RefreshRequest, response: Response, db: Session = Depends(get_db)):
    settings = get_settings()
    try:
        token_payload = decode_token(payload.refresh_token, settings.jwt_refresh_secret_key, "refresh")
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token expired. Please sign in again.")
    user = db.query(User).filter(User.id == int(token_payload["sub"]), User.is_active.is_(True)).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Active user not found")
    csrf = new_csrf_token()
    response.set_cookie("csrf_token", csrf, httponly=False, secure=True, samesite="strict", max_age=1800)
    return TokenPair(access_token=create_access_token(str(user.id), user.role.value), refresh_token=create_refresh_token(str(user.id), user.role.value), csrf_token=csrf)


@router.post("/logout")
def logout(request: Request, response: Response, user: User = Depends(current_user), db: Session = Depends(get_db)):
    response.delete_cookie("csrf_token")
    audit(db, user, AuditAction.logout, request_ip(request), {})
    db.commit()
    return {"message": "Logged out successfully"}


@router.get("/profile", response_model=UserRead)
def profile(user: User = Depends(current_user)):
    return user
