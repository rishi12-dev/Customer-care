from io import BytesIO
from time import perf_counter
import re
import pandas as pd
from sqlalchemy import or_, text
from sqlalchemy.orm import Session
from app.models.entities import NdrTrackingRecord, Order


BATCH_SIZE = 1500


def _clean(value):
    if pd.isna(value):
        return None
    if isinstance(value, pd.Timestamp):
        return value.isoformat()
    return str(value).strip()


def _key(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", value.lower())


def _digits(value: str | None) -> str | None:
    if not value:
        return None
    digits = re.sub(r"\D", "", value)
    return digits or None


def _find_column(headers: list[str], patterns: list[str]) -> str | None:
    keyed = {header: _key(header) for header in headers}
    for header, normalized in keyed.items():
        if any(pattern in normalized for pattern in patterns):
            return header
    return None


def _read_frame(content: bytes, filename: str) -> tuple[pd.DataFrame | None, list[str], list[str]]:
    warnings: list[str] = []
    try:
        frame = pd.read_excel(BytesIO(content), dtype=object)
    except Exception as exc:
        return None, [f"{filename}: unable to read Excel file: {exc}"], warnings
    if frame.empty:
        return frame, [f"{filename}: file has no NDR tracking rows"], warnings
    if len(frame.columns) != len(set(frame.columns)):
        return frame, [f"{filename}: duplicate columns are not allowed"], warnings
    if len(frame) > 100000:
        warnings.append(f"{filename}: large NDR file detected")
    return frame, [], warnings


def preview_ndr_file(content: bytes, filename: str) -> dict:
    frame, errors, warnings = _read_frame(content, filename)
    headers = [] if frame is None else list(frame.columns)
    rows = [] if frame is None else frame.head(20).where(pd.notna(frame.head(20)), None).to_dict(orient="records")
    return {"headers": headers, "rows": rows, "records": 0 if frame is None else len(frame), "errors": errors, "warnings": warnings, "valid": not errors}


def _rows_from_frame(frame: pd.DataFrame, filename: str) -> list[dict]:
    headers = list(frame.columns)
    order_col = _find_column(headers, ["orderno", "orderid", "order"])
    docket_col = _find_column(headers, ["docket", "awb", "waybill", "tracking", "lrno"])
    phone_col = _find_column(headers, ["mobile", "phone", "contact"])
    status_col = _find_column(headers, ["status", "stage"])
    agent_col = _find_column(headers, ["agent", "user", "executive", "caller"])
    remark_col = _find_column(headers, ["remark", "comment", "remarks", "callremark", "ndrremark"])
    time_col = _find_column(headers, ["datetime", "timestamp", "updatedat", "createdat", "date", "time"])

    rows: list[dict] = []
    for index, row in frame.iterrows():
        raw = {str(header): _clean(row[header]) for header in headers}
        rows.append(
            {
                "upload_filename": filename,
                "row_number": int(index) + 2,
                "order_no": _clean(row[order_col]) if order_col else None,
                "docket_number": _clean(row[docket_col]) if docket_col else None,
                "phone": _digits(_clean(row[phone_col])) if phone_col else None,
                "status": _clean(row[status_col]) if status_col else None,
                "agent": _clean(row[agent_col]) if agent_col else None,
                "remark": _clean(row[remark_col]) if remark_col else None,
                "event_time": _clean(row[time_col]) if time_col else None,
                "raw_data": raw,
            }
        )
    return rows


def _clear_ndr_records(db: Session) -> None:
    dialect = db.bind.dialect.name if db.bind else ""
    if dialect == "postgresql":
        db.execute(text('TRUNCATE TABLE "ndr_tracking_records" RESTART IDENTITY'))
        return
    db.query(NdrTrackingRecord).delete(synchronize_session=False)


def replace_ndr_records(db: Session, content: bytes, filename: str) -> dict:
    started = perf_counter()
    frame, errors, warnings = _read_frame(content, filename)
    if errors or frame is None:
        return {"records": 0, "duration_ms": 0, "errors": errors, "warnings": warnings, "backup_id": 0}

    rows = _rows_from_frame(frame, filename)
    _clear_ndr_records(db)
    inserted = 0
    for index in range(0, len(rows), BATCH_SIZE):
        batch = rows[index : index + BATCH_SIZE]
        db.bulk_insert_mappings(NdrTrackingRecord, batch)
        inserted += len(batch)
    db.commit()
    return {"records": inserted, "duration_ms": int((perf_counter() - started) * 1000), "errors": [], "warnings": warnings, "backup_id": 0}


def tracking_history_for_order(db: Session, order: Order) -> list[dict]:
    phone_digits = _digits(order.customer_phone_number)
    alt_digits = _digits(order.alt_no)
    filters = [
        NdrTrackingRecord.order_no == order.order_no,
        NdrTrackingRecord.docket_number == order.docket_number,
    ]
    if phone_digits:
        filters.append(NdrTrackingRecord.phone == phone_digits)
    if alt_digits:
        filters.append(NdrTrackingRecord.phone == alt_digits)
    rows = (
        db.query(NdrTrackingRecord)
        .filter(or_(*filters))
        .order_by(NdrTrackingRecord.id.desc())
        .limit(100)
        .all()
    )
    return [
        {
            "id": row.id,
            "row_number": row.row_number,
            "upload_filename": row.upload_filename,
            "order_no": row.order_no,
            "docket_number": row.docket_number,
            "phone": row.phone,
            "status": row.status,
            "agent": row.agent,
            "remark": row.remark,
            "event_time": row.event_time,
            "raw_data": row.raw_data,
        }
        for row in rows
    ]
