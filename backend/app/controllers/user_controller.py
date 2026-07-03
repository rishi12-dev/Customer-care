from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api.dependencies import current_user, require_admin
from app.config.database import get_db
from app.models.entities import AuditAction, User
from app.schemas.dto import AvatarUpdate, UserCreate, UserRead, UserUpdate
from app.services.audit_service import audit
from app.utils.security import hash_password


router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserRead])
def list_users(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    return db.query(User).order_by(User.created_at.desc()).all()


@router.post("", response_model=UserRead)
def create_user(payload: UserCreate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=409, detail="A user with this email already exists")
    user = User(email=payload.email, full_name=payload.full_name, hashed_password=hash_password(payload.password), role=payload.role)
    db.add(user)
    db.flush()
    audit(db, admin, AuditAction.user_change, None, {"created_user_id": user.id})
    db.commit()
    db.refresh(user)
    return user


def _update_avatar(db: Session, actor: User, user: User, payload: AvatarUpdate) -> User:
    value = payload.avatar_data_url
    if value and not value.startswith("data:image/"):
        raise HTTPException(status_code=400, detail="Upload a valid image file")
    user.avatar_data_url = value
    audit(db, actor, AuditAction.user_change, None, {"avatar_user_id": user.id})
    db.commit()
    db.refresh(user)
    return user


@router.put("/me/avatar", response_model=UserRead)
def update_my_avatar(payload: AvatarUpdate, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return _update_avatar(db, user, user, payload)


@router.put("/{user_id}/avatar", response_model=UserRead)
def update_user_avatar(user_id: int, payload: AvatarUpdate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return _update_avatar(db, admin, user, payload)


@router.put("/{user_id}", response_model=UserRead)
def update_user(user_id: int, payload: UserUpdate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    values = payload.model_dump(exclude_unset=True)
    if "password" in values:
        user.hashed_password = hash_password(values.pop("password"))
    for key, value in values.items():
        setattr(user, key, value)
    audit(db, admin, AuditAction.user_change, None, {"updated_user_id": user.id})
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}")
def delete_user(user_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Administrators cannot delete their own account")
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    audit(db, admin, AuditAction.user_change, None, {"deleted_user_id": user_id})
    db.commit()
    return {"message": "User deleted"}
