from datetime import date, datetime
from zoneinfo import ZoneInfo
import re

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.dependencies import current_user, request_ip
from app.config.database import get_db
from app.config.settings import get_settings
from app.models.entities import AuditAction, NdrCallFeedback, NdrTrackingRecord, User, UserRole
from app.services.audit_service import audit


router = APIRouter(prefix="/ndr/calls", tags=["ndr-calling"])


class FeedbackPayload(BaseModel):
    disposition: str = Field(min_length=2, max_length=80)
    remarks: str = Field(default="", max_length=2000)
    callback_date: date | None = None


def _today() -> date:
    settings = get_settings()
    return datetime.now(ZoneInfo(settings.app_timezone)).date()


def _normal(value: str | None) -> str:
    return re.sub(r"[^a-z0-9]", "", str(value or "").casefold())


def _is_assigned_to(record: NdrTrackingRecord, user: User) -> bool:
    agent = _normal(record.agent)
    if not agent:
        return False
    candidates = {_normal(user.full_name), _normal(user.email.split("@", 1)[0])}
    return agent in candidates or any(agent in candidate or candidate in agent for candidate in candidates if candidate)


def _raw_value(raw: dict, names: list[str]) -> str | None:
    normalized = {re.sub(r"[^a-z0-9]", "", str(key).casefold()): value for key, value in (raw or {}).items()}
    for name in names:
        value = normalized.get(re.sub(r"[^a-z0-9]", "", name.casefold()))
        if value is not None and str(value).strip() not in {"", "nan", "None"}:
            return str(value).strip()
    return None


def _serialize(record: NdrTrackingRecord, feedback: NdrCallFeedback | None) -> dict:
    raw = record.raw_data or {}
    return {
        "id": record.id,
        "order_no": record.order_no,
        "docket_number": record.docket_number,
        "customer_name": _raw_value(raw, ["Cx Name", "Customer Name", "Customer"]) or "Customer",
        "phone": record.phone or _raw_value(raw, ["Mobile No", "Mobile", "Phone"]),
        "alternate": _raw_value(raw, ["Alt No", "Alternate", "Alternate Mobile No"]),
        "dx_mail": _raw_value(raw, ["DX MAIL", "DX Mail"]),
        "shipment": _raw_value(raw, ["Shipment", "Courier"]) or "Courier",
        "courier_remark": record.status,
        "oms_status": _raw_value(raw, ["Current status", "OMS STATUS"]),
        "our_edd": _raw_value(raw, ["OUR EDD", "EDD"]),
        "event_time": record.event_time,
        "agent": record.agent,
        "feedback": None if not feedback else {
            "disposition": feedback.disposition,
            "remarks": feedback.remarks,
            "callback_date": feedback.callback_date,
            "updated_at": feedback.updated_at,
        },
    }


def _records_for_day(db: Session, user: User) -> list[NdrTrackingRecord]:
    day = _today().isoformat()
    records = db.query(NdrTrackingRecord).filter(NdrTrackingRecord.event_time == day).order_by(NdrTrackingRecord.id.asc()).all()
    if user.role == UserRole.admin:
        return records
    return [record for record in records if _is_assigned_to(record, user)]


@router.get("")
def my_calls(user: User = Depends(current_user), db: Session = Depends(get_db)):
    records = _records_for_day(db, user)
    feedback = {item.ndr_record_id: item for item in db.query(NdrCallFeedback).filter(NdrCallFeedback.ndr_record_id.in_([record.id for record in records])).all()} if records else {}
    return {"date": _today(), "total": len(records), "completed": sum(record.id in feedback for record in records), "calls": [_serialize(record, feedback.get(record.id)) for record in records]}


@router.post("/{record_id}/feedback")
def save_feedback(record_id: int, payload: FeedbackPayload, user: User = Depends(current_user), db: Session = Depends(get_db)):
    record = db.get(NdrTrackingRecord, record_id)
    if not record or record.event_time != _today().isoformat() or (user.role != UserRole.admin and not _is_assigned_to(record, user)):
        raise HTTPException(status_code=404, detail="Assigned call not found")
    feedback = db.query(NdrCallFeedback).filter(NdrCallFeedback.ndr_record_id == record_id).first()
    if feedback is None:
        feedback = NdrCallFeedback(ndr_record_id=record_id, user_id=user.id, disposition=payload.disposition.strip(), remarks=payload.remarks.strip(), callback_date=payload.callback_date)
        db.add(feedback)
    else:
        feedback.user_id = user.id
        feedback.disposition = payload.disposition.strip()
        feedback.remarks = payload.remarks.strip()
        feedback.callback_date = payload.callback_date
    audit(db, user, AuditAction.search, None, {"action": "ndr_call_feedback", "record_id": record_id, "disposition": payload.disposition})
    db.commit()
    return {"saved": True, "record_id": record_id}


@router.get("/performance")
def performance(user: User = Depends(current_user), db: Session = Depends(get_db)):
    if user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    records = _records_for_day(db, user)
    grouped: dict[str, list[NdrTrackingRecord]] = {}
    for record in records:
        grouped.setdefault(record.agent or "Unassigned", []).append(record)
    ids = [record.id for record in records]
    feedback_rows = db.query(NdrCallFeedback).filter(NdrCallFeedback.ndr_record_id.in_(ids)).all() if ids else []
    completed = {row.ndr_record_id for row in feedback_rows}
    rows = [{"agent": agent, "assigned": len(items), "completed": sum(item.id in completed for item in items), "pending": sum(item.id not in completed for item in items)} for agent, items in sorted(grouped.items())]
    return {"date": _today(), "total_assigned": len(records), "total_completed": len(completed), "agents": rows}
