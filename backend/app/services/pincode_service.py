from datetime import date, datetime
from io import BytesIO
from time import perf_counter
import re
import pandas as pd
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.models.entities import PincodeService


EXPECTED_HEADERS = ["sNo", "date", "pincode", "state", "city", "zone", "active", "warehouse", "courier"]
BATCH_SIZE = 2000


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
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    parsed = pd.to_datetime(str(value).strip(), errors="coerce", dayfirst=True)
    return None if pd.isna(parsed) else parsed.date()


def _parse_bool(value) -> bool:
    if isinstance(value, bool):
        return value
    if value in (None, ""):
        return False
    return str(value).strip().lower() in {"true", "1", "yes", "y", "active"}


from fastapi import HTTPException


def resolve_pincode_query(value) -> tuple[str, bool]:
    """
    Smart resolution for numbers received from customer care:
    - 7-digit numbers (e.g. 1100010): auto-divides by 10 (/10) -> 110001
    - 6-digit standard pincodes (e.g. 110001): returns 110001
    - Floats (e.g. 110001.0): returns 110001
    Returns (resolved_6digit_pincode, was_divided_by_10)
    """
    raw_str = str(_clean(value) or "").strip()
    if "." in raw_str:
        try:
            f_val = float(raw_str)
            raw_str = str(int(f_val))
        except ValueError:
            pass
    digits = re.sub(r"\D", "", raw_str)
    if len(digits) == 7:
        return digits[:6], True
    if len(digits) == 6:
        return digits, False
    if len(digits) > 7:
        return digits[:6], True
    return digits, False


def normalize_pincode(value) -> str:
    pincode, _ = resolve_pincode_query(value)
    return pincode


def read_pincode_excel(content: bytes, filename: str) -> tuple[pd.DataFrame | None, list[str], list[str]]:
    warnings: list[str] = []
    try:
        frame = pd.read_excel(BytesIO(content), dtype=object)
    except Exception as exc:
        return None, [f"{filename}: unable to read Excel file: {exc}"], warnings

    headers = list(frame.columns)
    errors: list[str] = []
    if headers != EXPECTED_HEADERS:
        errors.append(f"{filename}: headers must be {EXPECTED_HEADERS}")
    if frame.empty:
        errors.append(f"{filename}: file has no pincode rows")
    if len(frame) > 50000:
        warnings.append(f"{filename}: large pincode file detected")
    return frame, errors, warnings


def preview_pincode_files(files: list[tuple[str, bytes]]) -> dict:
    errors: list[str] = []
    warnings: list[str] = []
    rows: list[dict] = []
    records = 0
    headers: list[str] = []
    for filename, content in files:
        frame, file_errors, file_warnings = read_pincode_excel(content, filename)
        errors.extend(file_errors)
        warnings.extend(file_warnings)
        if frame is None:
            continue
        records += len(frame)
        headers = list(frame.columns)
        if len(rows) < 20:
            rows.extend(frame.head(20 - len(rows)).where(pd.notna(frame.head(20 - len(rows))), None).to_dict(orient="records"))
    return {"headers": headers, "rows": rows, "records": records, "errors": errors, "warnings": warnings, "valid": not errors}


def _rows_from_frame(frame: pd.DataFrame, filename: str) -> list[dict]:
    rows: list[dict] = []
    for _, row in frame.iterrows():
        pincode = normalize_pincode(row["pincode"])
        courier = str(_clean(row["courier"]) or "").strip()
        if not pincode or not courier:
            continue
        rows.append(
            {
                "pincode": pincode,
                "state": _clean(row["state"]),
                "city": _clean(row["city"]),
                "zone": _clean(row["zone"]),
                "active": _parse_bool(_clean(row["active"])),
                "warehouse": _clean(row["warehouse"]),
                "courier": courier,
                "service_date": _parse_date(_clean(row["date"])),
                "source_file": filename,
            }
        )
    return rows


def _clear_pincode_services(db: Session) -> None:
    dialect = db.bind.dialect.name if db.bind else ""
    if dialect == "postgresql":
        db.execute(text('TRUNCATE TABLE "pincode_services" RESTART IDENTITY'))
        return
    db.query(PincodeService).delete(synchronize_session=False)


def replace_pincode_services(db: Session, files: list[tuple[str, bytes]]) -> dict:
    started = perf_counter()
    errors: list[str] = []
    warnings: list[str] = []
    all_rows: list[dict] = []

    for filename, content in files:
        frame, file_errors, file_warnings = read_pincode_excel(content, filename)
        errors.extend(file_errors)
        warnings.extend(file_warnings)
        if frame is not None:
            all_rows.extend(_rows_from_frame(frame, filename))

    if errors:
        return {"records": 0, "duration_ms": 0, "errors": errors, "warnings": warnings}

    _clear_pincode_services(db)
    inserted = 0
    for index in range(0, len(all_rows), BATCH_SIZE):
        batch = all_rows[index : index + BATCH_SIZE]
        db.bulk_insert_mappings(PincodeService, batch)
        inserted += len(batch)
    db.commit()
    return {"records": inserted, "duration_ms": int((perf_counter() - started) * 1000), "errors": [], "warnings": warnings}


def search_pincode_services(db: Session, query: str) -> dict:
    resolved_pincode, was_divided = resolve_pincode_query(query)
    if len(resolved_pincode) != 6:
        return {"query": query, "pincode": resolved_pincode, "was_divided_by_10": was_divided, "results": []}
    rows = (
        db.query(PincodeService)
        .filter(PincodeService.pincode == resolved_pincode)
        .order_by(PincodeService.active.desc(), PincodeService.courier.asc(), PincodeService.warehouse.asc())
        .all()
    )
    return {"query": query, "pincode": resolved_pincode, "was_divided_by_10": was_divided, "results": rows}


def bulk_search_pincode_services(db: Session, raw_queries: list[str]) -> dict:
    resolved_items: list[dict] = []
    unique_pincodes: set[str] = set()

    for raw in raw_queries:
        trimmed = str(raw).strip()
        if not trimmed:
            continue
        pincode, was_divided = resolve_pincode_query(trimmed)
        resolved_items.append({"query": trimmed, "resolved_pincode": pincode, "was_divided_by_10": was_divided})
        if len(pincode) == 6:
            unique_pincodes.add(pincode)

    records = []
    if unique_pincodes:
        records = (
            db.query(PincodeService)
            .filter(PincodeService.pincode.in_(list(unique_pincodes)))
            .order_by(PincodeService.pincode.asc(), PincodeService.active.desc(), PincodeService.courier.asc())
            .all()
        )

    pincode_map: dict[str, list[PincodeService]] = {}
    for r in records:
        pincode_map.setdefault(r.pincode, []).append(r)

    items = []
    matched_count = 0
    for item in resolved_items:
        p = item["resolved_pincode"]
        services = pincode_map.get(p, [])
        if services:
            matched_count += 1
        items.append(
            {
                "query": item["query"],
                "resolved_pincode": p,
                "was_divided_by_10": item["was_divided_by_10"],
                "results": services,
            }
        )

    return {
        "total_queries": len(resolved_items),
        "matched_queries": matched_count,
        "items": items,
    }


def toggle_pincode_service_active(db: Session, service_id: int, active: bool | None = None) -> PincodeService:
    record = db.get(PincodeService, service_id)
    if not record:
        raise HTTPException(status_code=404, detail=f"Pincode record #{service_id} not found")
    record.active = (not record.active) if active is None else active
    db.commit()
    db.refresh(record)
    return record


def set_pincode_all_active(db: Session, pincode_input: str, active: bool) -> list[PincodeService]:
    pincode, _ = resolve_pincode_query(pincode_input)
    if len(pincode) != 6:
        raise HTTPException(status_code=400, detail="Pincode must resolve to 6 digits")
    records = db.query(PincodeService).filter(PincodeService.pincode == pincode).all()
    if not records:
        raise HTTPException(status_code=404, detail=f"No courier records found for pincode {pincode}")
    for r in records:
        r.active = active
    db.commit()
    for r in records:
        db.refresh(r)
    return records


def export_pincode_services_excel(db: Session) -> BytesIO:
    records = db.query(PincodeService).order_by(PincodeService.pincode.asc(), PincodeService.courier.asc()).all()
    rows = []
    for idx, r in enumerate(records, start=1):
        rows.append(
            {
                "sNo": idx,
                "date": r.service_date.isoformat() if r.service_date else "",
                "pincode": r.pincode,
                "state": r.state or "",
                "city": r.city or "",
                "zone": r.zone or "",
                "active": r.active,
                "warehouse": r.warehouse or "",
                "courier": r.courier or "",
            }
        )
    df = pd.DataFrame(rows, columns=EXPECTED_HEADERS)
    buffer = BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="PincodeServices")
    buffer.seek(0)
    return buffer
