from sqlalchemy.orm import Session
from app.models.entities import AuditAction, AuditLog, User


def audit(db: Session, user: User | None, action: AuditAction, ip_address: str | None, metadata: dict | None = None) -> None:
    db.add(AuditLog(user_id=user.id if user else None, action=action, ip_address=ip_address, metadata_json=metadata or {}))
