from datetime import date, datetime
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


def _format_header(value) -> str:
    if isinstance(value, (datetime, date, pd.Timestamp)):
        return pd.to_datetime(value).date().isoformat()
    return str(value).strip()


def _looks_like_subheader_row(frame: pd.DataFrame) -> bool:
    if frame.empty:
        return False
    first = frame.iloc[0]
    text = " ".join(str(_clean(value) or "") for value in first.head(30))
    return "OrderNo" in text and ("Courier remark" in text or "Agent for NDR" in text or "Our Remarks" in text)


def _normalize_monthly_ndr_frame(frame: pd.DataFrame) -> pd.DataFrame:
    if not _looks_like_subheader_row(frame):
        frame.columns = [_format_header(column) for column in frame.columns]
        return frame

    first = frame.iloc[0]
    normalized_headers: list[str] = []
    current_date: str | None = None
    for index, column in enumerate(frame.columns):
        top = _format_header(column)
        sub = _format_header(first.iloc[index]) if index < len(first) and _clean(first.iloc[index]) is not None else ""
        if isinstance(column, (datetime, date, pd.Timestamp)):
            current_date = pd.to_datetime(column).date().isoformat()
            if normalized_headers and "courierremark" in _key(normalized_headers[-1]):
                normalized_headers[-1] = f"{current_date} - Courier remark"
            normalized_headers.append(f"{current_date} - {sub or 'Value'}")
        elif top.lower().startswith("unnamed") and current_date and sub:
            normalized_headers.append(f"{current_date} - {sub}")
        elif top.lower().startswith("unnamed") and sub:
            normalized_headers.append(sub)
        else:
            normalized_headers.append(top)

    deduped: list[str] = []
    seen: dict[str, int] = {}
    for header in normalized_headers:
        count = seen.get(header, 0)
        seen[header] = count + 1
        deduped.append(header if count == 0 else f"{header} ({count + 1})")

    frame = frame.iloc[1:].copy()
    frame.columns = deduped
    return frame


def _read_frame(content: bytes, filename: str, preview: bool = False) -> tuple[pd.DataFrame | None, list[str], list[str]]:
    warnings: list[str] = []
    try:
        frame = pd.read_excel(BytesIO(content), dtype=object, nrows=25 if preview else None)
    except Exception as exc:
        return None, [f"{filename}: unable to read Excel file: {exc}"], warnings
    frame = _normalize_monthly_ndr_frame(frame)
    if frame.empty:
        return frame, [f"{filename}: file has no NDR tracking rows"], warnings
    if len(frame.columns) != len(set(frame.columns)):
        return frame, [f"{filename}: duplicate columns are not allowed"], warnings
    if len(frame) > 100000:
        warnings.append(f"{filename}: large NDR file detected")
    return frame, [], warnings


def preview_ndr_file(content: bytes, filename: str) -> dict:
    frame, errors, warnings = _read_frame(content, filename, preview=True)
    headers = [] if frame is None else list(frame.columns)
    rows = [] if frame is None else frame.head(20).where(pd.notna(frame.head(20)), None).to_dict(orient="records")
    return {"headers": headers, "rows": rows, "records": 0 if frame is None else len(frame), "errors": errors, "warnings": warnings, "valid": not errors}


def _rows_from_frame(frame: pd.DataFrame, filename: str) -> list[dict]:
    headers = list(frame.columns)
    order_col = _find_column(headers, ["orderno", "orderid", "order"])
    docket_col = _find_column(headers, ["docket", "awb", "waybill", "tracking", "lrno"])
    phone_col = _find_column(headers, ["mobile", "phone", "contact"])
    status_col = _find_column(headers, ["currentstatus", "currenstatus", "omsstatus", "status", "stage"])
    agent_col = _find_column(headers, ["agent", "user", "executive", "caller"])
    remark_col = _find_column(headers, ["remark", "comment", "remarks", "callremark", "ndrremark"])
    time_col = _find_column(headers, ["datetime", "timestamp", "updatedat", "createdat", "raiseddate", "date", "time"])
    date_groups: dict[str, dict[str, str]] = {}
    date_group_columns: set[str] = set()
    for header in headers:
        match = re.match(r"(\d{4}-\d{2}-\d{2})\s+-\s+(.+)", str(header))
        if not match:
            continue
        date_group_columns.add(header)
        day, field = match.groups()
        normalized_field = _key(field)
        group = date_groups.setdefault(day, {})
        if "courierremark" in normalized_field:
            group["courier_remark"] = header
        elif "agent" in normalized_field:
            group["agent"] = header
        elif "ourremarks" in normalized_field or "remark" in normalized_field:
            group["our_remark"] = header

    rows: list[dict] = []
    for index, row in frame.iterrows():
        raw = {str(header): _clean(row[header]) for header in headers}
        base_raw = {str(header): value for header, value in raw.items() if header not in date_group_columns}
        base = {
            "upload_filename": filename,
            "row_number": int(index) + 2,
            "order_no": _clean(row[order_col]) if order_col else None,
            "docket_number": _clean(row[docket_col]) if docket_col else None,
            "phone": _digits(_clean(row[phone_col])) if phone_col else None,
        }
        added = False
        for day, group in date_groups.items():
            courier_remark = _clean(row[group["courier_remark"]]) if group.get("courier_remark") else None
            agent = _clean(row[group["agent"]]) if group.get("agent") else None
            our_remark = _clean(row[group["our_remark"]]) if group.get("our_remark") else None
            if not any([courier_remark, agent, our_remark]):
                continue
            event_raw = {
                **base_raw,
                "_tracking_date": day,
                "Courier remark": courier_remark,
                "Agent for NDR": agent,
                "Our Remarks": our_remark,
            }
            rows.append(
                {
                    **base,
                    "status": courier_remark or (_clean(row[status_col]) if status_col else None),
                    "agent": agent,
                    "remark": our_remark or courier_remark,
                    "event_time": day,
                    "raw_data": event_raw,
                }
            )
            added = True
        if not added:
            rows.append(
                {
                    **base,
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
