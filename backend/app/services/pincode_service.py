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


HEADER_SYNONYMS = {
    "sNo": ["sno", "s_no", "s.no", "sr no", "sr.no", "serial no", "serial number", "id", "sl no", "sl.no"],
    "date": ["date", "service_date", "updated_date", "entry_date", "created_date"],
    "pincode": ["pincode", "pin code", "pin", "customer pincode", "postal_code", "zip"],
    "state": ["state", "province"],
    "city": ["city", "district", "town"],
    "zone": ["zone", "region", "area"],
    "active": ["active", "status", "is_active", "enabled"],
    "warehouse": ["warehouse", "store", "hub", "location", "facility"],
    "courier": ["courier", "courier partner", "current courier", "recommended courier", "carrier", "transporter"],
}


def read_pincode_excel(content: bytes, filename: str) -> tuple[pd.DataFrame | None, list[str], list[str]]:
    warnings: list[str] = []
    try:
        frame = pd.read_excel(BytesIO(content), dtype=object)
    except Exception as exc:
        return None, [f"{filename}: unable to read Excel file: {exc}"], warnings

    if frame.empty:
        return frame, [f"{filename}: file has no pincode rows"], warnings

    # Normalize column names flexibly
    col_mapping: dict[str, str] = {}
    normalized_cols = {re.sub(r"[\s_\.\-]+", "", str(c).strip().lower()): c for c in frame.columns}

    for canonical, syns in HEADER_SYNONYMS.items():
        found = False
        for s in syns:
            s_clean = re.sub(r"[\s_\.\-]+", "", s.lower())
            if s_clean in normalized_cols:
                col_mapping[normalized_cols[s_clean]] = canonical
                found = True
                break
        if not found and canonical.lower() in normalized_cols:
            col_mapping[normalized_cols[canonical.lower()]] = canonical

    frame = frame.rename(columns=col_mapping)

    # Ensure required columns exist or can be defaulted
    if "pincode" not in frame.columns:
        return None, [f"{filename}: missing required 'pincode' column. Found columns: {list(frame.columns)}"], warnings

    if "courier" not in frame.columns:
        frame["courier"] = "Standard Courier"
        warnings.append(f"{filename}: 'courier' column missing, defaulted to 'Standard Courier'")

    if "warehouse" not in frame.columns:
        default_wh = filename.replace(".xlsx", "").replace(".xls", "").strip() or "Default Warehouse"
        frame["warehouse"] = default_wh
        warnings.append(f"{filename}: 'warehouse' column missing, defaulted to '{default_wh}'")

    if "active" not in frame.columns:
        frame["active"] = False

    if "date" not in frame.columns:
        frame["date"] = None

    if "state" not in frame.columns:
        frame["state"] = None

    if "city" not in frame.columns:
        frame["city"] = None

    if "zone" not in frame.columns:
        frame["zone"] = None

    if "sNo" not in frame.columns:
        frame["sNo"] = [i + 1 for i in range(len(frame))]

    errors: list[str] = []
    if len(frame) > 50000:
        warnings.append(f"{filename}: large pincode file detected ({len(frame)} rows)")
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


import math


def _rows_from_frame(frame: pd.DataFrame, filename: str) -> list[dict]:
    rows: list[dict] = []
    for idx, row in frame.iterrows():
        pincode = normalize_pincode(row["pincode"])
        courier = str(_clean(row["courier"]) or "").strip()
        if not pincode or not courier:
            continue
        raw_s_no = row.get("sNo") if "sNo" in row else None
        try:
            s_no = int(raw_s_no) if pd.notna(raw_s_no) else (idx + 1)
        except (ValueError, TypeError):
            s_no = idx + 1
        rows.append(
            {
                "s_no": s_no,
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


def _enrich_service_dict(r: PincodeService) -> dict:
    row_s_no = r.s_no if r.s_no is not None else r.id
    row_div = round(row_s_no / 10.0, 2)
    page_num = math.ceil(row_s_no / 10.0) if row_s_no else None
    row_on_page = ((row_s_no - 1) % 10) + 1 if row_s_no else None
    return {
        "id": r.id,
        "s_no": row_s_no,
        "divided_by_10": row_div,
        "formula": f"{row_s_no} ÷ 10 = {row_div}",
        "page_number": page_num,
        "row_on_page": row_on_page,
        "pincode": r.pincode,
        "state": r.state,
        "city": r.city,
        "zone": r.zone,
        "active": r.active,
        "warehouse": r.warehouse,
        "courier": r.courier,
        "service_date": r.service_date,
        "source_file": r.source_file,
    }


def search_pincode_services(db: Session, query: str) -> dict:
    raw_query = str(query).strip()
    digits = re.sub(r"\D", "", raw_query)

    resolved_pincode, was_divided = resolve_pincode_query(raw_query)

    rows: list[PincodeService] = []
    if len(resolved_pincode) == 6:
        rows = (
            db.query(PincodeService)
            .filter(PincodeService.pincode == resolved_pincode)
            .order_by(PincodeService.active.desc(), PincodeService.courier.asc(), PincodeService.warehouse.asc())
            .all()
        )

    # If no records and user entered a number < 6 digits, check if they entered an sNo directly
    if not rows and digits and len(digits) < 6:
        try:
            num = int(digits)
            rows = (
                db.query(PincodeService)
                .filter((PincodeService.s_no == num) | (PincodeService.id == num))
                .order_by(PincodeService.active.desc(), PincodeService.courier.asc())
                .all()
            )
            if rows:
                resolved_pincode = rows[0].pincode
        except ValueError:
            pass

    enriched = [_enrich_service_dict(r) for r in rows]

    s_no = None
    divided_val = None
    formula = None
    page_num = None
    row_on_page = None

    if enriched:
        first = enriched[0]
        s_no = first["s_no"]
        divided_val = first["divided_by_10"]
        formula = first["formula"]
        page_num = first["page_number"]
        row_on_page = first["row_on_page"]
    elif digits:
        try:
            num = int(digits)
            s_no = num
            divided_val = round(num / 10.0, 2)
            formula = f"{num} ÷ 10 = {divided_val}"
            page_num = math.ceil(num / 10.0)
            row_on_page = ((num - 1) % 10) + 1
        except ValueError:
            pass

    return {
        "query": query,
        "pincode": resolved_pincode,
        "s_no": s_no,
        "divided_by_10": divided_val,
        "formula": formula,
        "page_number": page_num,
        "row_on_page": row_on_page,
        "was_divided_by_10": was_divided,
        "results": enriched,
    }


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

    pincode_map: dict[str, list[dict]] = {}
    for r in records:
        pincode_map.setdefault(r.pincode, []).append(_enrich_service_dict(r))

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
