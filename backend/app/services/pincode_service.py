from datetime import date, datetime
from io import BytesIO
from time import perf_counter
import re
import pandas as pd
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


def normalize_pincode(value) -> str:
    text = str(_clean(value) or "")
    digits = re.sub(r"\D", "", text)
    return digits[:6] if len(digits) >= 6 else digits


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

    db.query(PincodeService).delete(synchronize_session=False)
    inserted = 0
    for index in range(0, len(all_rows), BATCH_SIZE):
        batch = all_rows[index : index + BATCH_SIZE]
        db.bulk_insert_mappings(PincodeService, batch)
        inserted += len(batch)
    db.commit()
    return {"records": inserted, "duration_ms": int((perf_counter() - started) * 1000), "errors": [], "warnings": warnings}


def search_pincode_services(db: Session, query: str) -> dict:
    pincode = normalize_pincode(query)
    if len(pincode) != 6:
        return {"query": query, "pincode": pincode, "results": []}
    rows = (
        db.query(PincodeService)
        .filter(PincodeService.pincode == pincode)
        .order_by(PincodeService.active.desc(), PincodeService.courier.asc(), PincodeService.warehouse.asc())
        .all()
    )
    return {"query": query, "pincode": pincode, "results": rows}
