from datetime import date, datetime
from io import BytesIO
from time import perf_counter
import pandas as pd
from sqlalchemy.orm import Session
from app.models.entities import AuditAction, Backup, Order, UploadHistory, UploadStatus, User
from app.services.audit_service import audit


EXPECTED_HEADERS = [
    "ORDER NO",
    "CUSTOMER NAME",
    "CUSTOMER PHONE NUMBER",
    "ALT NO",
    "DOCKET NUMBER",
    "SHIPMENT",
    "REMARK",
    "CURRENT STATUS",
    "Expected Delivery",
    "Delivery Date",
]


def _clean(value):
    if pd.isna(value):
        return None
    if isinstance(value, pd.Timestamp):
        return value.date()
    if isinstance(value, datetime):
        return value.date()
    return str(value).strip()


def _parse_date(value) -> date | None:
    if value in (None, ""):
        return None
    parsed = pd.to_datetime(value, errors="coerce")
    if pd.isna(parsed):
        return None
    return parsed.date()


def normalize_status(status: str) -> str:
    value = (status or "Pending").strip()
    lowered = value.lower()
    if "delivered" in lowered:
        return "Delivered"
    if "out for delivery" in lowered or lowered == "ofd" or " ofd" in lowered:
        return "Out For Delivery"
    if "in transit" in lowered or "transit" in lowered:
        return "In Transit"
    if "ndr" in lowered:
        return "NDR"
    if "rto" in lowered or "return to origin" in lowered:
        return "RTO"
    if "delay" in lowered:
        return "Delayed"
    return value


def apply_delay_rule(status: str, expected_delivery: date | None, delivery_date: date | None) -> str:
    if expected_delivery and expected_delivery < date.today() and not delivery_date:
        return "Delayed"
    return normalize_status(status)


def read_excel(content: bytes) -> tuple[pd.DataFrame | None, list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    try:
        frame = pd.read_excel(BytesIO(content), dtype=object)
    except Exception as exc:
        return None, [f"Unable to read Excel file: {exc}"], warnings
    headers = list(frame.columns)
    if len(headers) != len(set(headers)):
        errors.append("Duplicate columns are not allowed.")
    if headers != EXPECTED_HEADERS:
        errors.append("Excel headers must match the required template exactly.")
    if frame.empty:
        errors.append("Excel file has no order rows.")
    if len(frame) > 100000:
        warnings.append("Large upload detected. Processing can take longer on free hosting.")
    return frame, errors, warnings


def preview_excel(content: bytes) -> dict:
    frame, errors, warnings = read_excel(content)
    headers = [] if frame is None else list(frame.columns)
    rows = [] if frame is None else frame.head(20).where(pd.notna(frame.head(20)), None).to_dict(orient="records")
    return {"headers": headers, "rows": rows, "records": 0 if frame is None else len(frame), "errors": errors, "warnings": warnings, "valid": not errors}


def serialize_orders(db: Session) -> list[dict]:
    return [
        {
            "order_no": order.order_no,
            "customer_name": order.customer_name,
            "customer_phone_number": order.customer_phone_number,
            "alt_no": order.alt_no,
            "docket_number": order.docket_number,
            "shipment": order.shipment,
            "remark": order.remark,
            "current_status": order.current_status,
            "expected_delivery": order.expected_delivery.isoformat() if order.expected_delivery else None,
            "delivery_date": order.delivery_date.isoformat() if order.delivery_date else None,
        }
        for order in db.query(Order).all()
    ]


def create_backup(db: Session, user: User, label: str, ip_address: str | None) -> Backup:
    payload = serialize_orders(db)
    backup = Backup(label=label, created_by_id=user.id, records=len(payload), payload=payload)
    db.add(backup)
    db.flush()
    audit(db, user, AuditAction.backup, ip_address, {"backup_id": backup.id, "records": backup.records})
    return backup


def commit_upload(db: Session, content: bytes, filename: str, user: User, ip_address: str | None) -> dict:
    started = perf_counter()
    frame, errors, warnings = read_excel(content)
    if errors or frame is None:
        history = UploadHistory(filename=filename, uploaded_by_id=user.id, records=0, duration_ms=0, status=UploadStatus.failed, errors=errors, warnings=warnings)
        db.add(history)
        audit(db, user, AuditAction.upload, ip_address, {"filename": filename, "status": "failed", "errors": errors})
        db.commit()
        return {"records": 0, "duration_ms": 0, "errors": errors, "warnings": warnings, "backup_id": 0}

    backup = create_backup(db, user, f"Automatic backup before {filename}", ip_address)
    db.query(Order).delete()
    records: list[Order] = []
    for _, row in frame.iterrows():
        expected = _parse_date(_clean(row["Expected Delivery"]))
        delivered = _parse_date(_clean(row["Delivery Date"]))
        status = apply_delay_rule(str(_clean(row["CURRENT STATUS"]) or "Pending"), expected, delivered)
        records.append(
            Order(
                order_no=str(_clean(row["ORDER NO"]) or ""),
                customer_name=str(_clean(row["CUSTOMER NAME"]) or ""),
                customer_phone_number=str(_clean(row["CUSTOMER PHONE NUMBER"]) or ""),
                alt_no=_clean(row["ALT NO"]),
                docket_number=str(_clean(row["DOCKET NUMBER"]) or ""),
                shipment=str(_clean(row["SHIPMENT"]) or ""),
                remark=_clean(row["REMARK"]),
                current_status=status,
                expected_delivery=expected,
                delivery_date=delivered,
            )
        )
    db.bulk_save_objects(records)
    duration_ms = int((perf_counter() - started) * 1000)
    history = UploadHistory(filename=filename, uploaded_by_id=user.id, records=len(records), duration_ms=duration_ms, status=UploadStatus.success, errors=[], warnings=warnings)
    db.add(history)
    audit(db, user, AuditAction.upload, ip_address, {"filename": filename, "status": "success", "records": len(records)})
    db.commit()
    return {"records": len(records), "duration_ms": duration_ms, "errors": [], "warnings": warnings, "backup_id": backup.id}


def restore_backup(db: Session, backup_id: int, user: User, ip_address: str | None) -> dict:
    backup = db.get(Backup, backup_id)
    if not backup:
        raise ValueError("Backup not found")
    create_backup(db, user, f"Automatic backup before restoring #{backup_id}", ip_address)
    db.query(Order).delete()
    rows = []
    for item in backup.payload:
        rows.append(Order(**{**item, "expected_delivery": _parse_date(item.get("expected_delivery")), "delivery_date": _parse_date(item.get("delivery_date"))}))
    db.bulk_save_objects(rows)
    audit(db, user, AuditAction.restore, ip_address, {"backup_id": backup_id, "records": len(rows)})
    db.commit()
    return {"records": len(rows), "backup_id": backup_id}
