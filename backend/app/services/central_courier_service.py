from __future__ import annotations

from datetime import date
from threading import Lock
from time import monotonic
from typing import Any

import httpx
from sqlalchemy.orm import Session

from app.config.settings import get_settings
from app.models.entities import NdrTrackingRecord
from app.services.ndr_dashboard_service import record_daily_snapshot
from app.services.ndr_service import _clear_ndr_records


class CentralCourierError(RuntimeError):
    pass


_refresh_lock = Lock()
_last_ndr_refresh = 0.0


def is_configured() -> bool:
    settings = get_settings()
    return bool(settings.central_courier_api_url and settings.central_courier_api_key)


def _client() -> httpx.Client:
    settings = get_settings()
    if not is_configured():
        raise CentralCourierError("Central Courier API is not configured")
    return httpx.Client(
        base_url=settings.central_courier_api_url.rstrip("/"),
        headers={"Authorization": f"Bearer {settings.central_courier_api_key}", "Accept": "application/json"},
        timeout=settings.central_courier_api_timeout_seconds,
    )


def _get(path: str, params: dict[str, Any] | None = None) -> dict:
    try:
        with _client() as client:
            response = client.get(path, params={key: value for key, value in (params or {}).items() if value not in {None, "", "all"}})
            response.raise_for_status()
            payload = response.json()
    except httpx.HTTPStatusError as exc:
        detail = "The courier service rejected this request."
        if exc.response.status_code == 401:
            detail = "Central Courier API key is invalid or expired."
        elif exc.response.status_code == 429:
            detail = "Courier API rate limit reached. Please try again shortly."
        raise CentralCourierError(detail) from exc
    except httpx.HTTPError as exc:
        raise CentralCourierError("Courier API is temporarily unavailable.") from exc
    if not isinstance(payload, dict):
        raise CentralCourierError("Courier API returned an invalid response.")
    return payload


def _date_value(value: Any) -> str | None:
    text = str(value or "").strip()
    return text[:10] if text else None


def _shipment_order(item: dict) -> dict:
    return {
        "id": int(item.get("id") or 0),
        "order_no": str(item.get("order_no") or "N/A"),
        "customer_name": str(item.get("customer_name") or item.get("customer") or "Customer details unavailable"),
        "customer_phone_number": str(item.get("mobile") or "N/A"),
        "alt_no": item.get("alt_no") or item.get("alternate_mobile"),
        "docket_number": str(item.get("awb_number") or item.get("awb") or "N/A"),
        "shipment": str(item.get("courier") or "Unknown"),
        "remark": item.get("courier_remarks") or item.get("remark"),
        "current_status": str(item.get("current_status") or item.get("status") or "Unknown"),
        "expected_delivery": _date_value(item.get("edd")),
        "delivery_date": _date_value(item.get("delivery_date")),
    }


def _query_params(query: str) -> list[dict[str, str]]:
    compact = "".join(character for character in query.strip() if character.isalnum())
    digits = "".join(character for character in compact if character.isdigit())
    if len(digits) == 10 and digits == compact:
        return [{"mobile": digits}, {"awb": compact}, {"order_no": compact}]
    if any(character.isalpha() for character in compact) or len(digits) >= 11:
        return [{"awb": compact}, {"order_no": compact}]
    return [{"order_no": compact}, {"awb": compact}]


def search_shipments(query: str) -> list[dict]:
    for params in _query_params(query):
        payload = _get("/api/v1/shipments", params)
        items = payload.get("data") or []
        if items:
            return [_shipment_order(item) for item in items if isinstance(item, dict)]
    return []


def _tracking_record(item: dict, row_number: int = 0) -> dict:
    raw = {
        "OrderNo": item.get("order_no"),
        "PincodeZone": item.get("zone"),
        "Shipment": item.get("courier"),
        "OUR EDD": _date_value(item.get("edd")),
        "Current status": item.get("status"),
        "Courier remark": item.get("courier_remarks"),
        "Agent for NDR": item.get("agent"),
        "Our Remarks": item.get("agent_remarks"),
        "Attempts": item.get("attempts"),
        "ShippingDate": _date_value(item.get("shipping_date")),
        "Warehouse": item.get("warehouse"),
        "Docketno": item.get("awb_number") or item.get("awb"),
        "Mobile No": item.get("mobile"),
        "Time": _date_value(item.get("date")),
    }
    return {
        "id": int(item.get("id") or row_number),
        "row_number": row_number or int(item.get("id") or 0),
        "upload_filename": "Central Courier API",
        "order_no": str(item.get("order_no") or "") or None,
        "docket_number": str(item.get("awb_number") or item.get("awb") or "") or None,
        "phone": str(item.get("mobile") or "") or None,
        "status": str(item.get("courier_remarks") or item.get("status") or "") or None,
        "agent": str(item.get("agent") or "") or None,
        "remark": str(item.get("agent_remarks") or item.get("courier_remarks") or "") or None,
        "event_time": _date_value(item.get("date")),
        "raw_data": raw,
    }


def search_ndr(query: str) -> list[dict]:
    records: list[dict] = []
    for params in _query_params(query):
        payload = _get("/api/v1/ndr", {**params, "page": 1, "page_size": 100})
        items = payload.get("data") or []
        if items:
            records = [_tracking_record(item, index + 1) for index, item in enumerate(items) if isinstance(item, dict)]
            break
    return records


def shipment_followups(courier: str, awb: str) -> list[dict]:
    payload = _get(f"/api/v1/shipments/{courier}/{awb}/followups", {"page": 1, "page_size": 100})
    return [_tracking_record(item, index + 1) for index, item in enumerate(payload.get("data") or []) if isinstance(item, dict)]


def _all_ndr_records() -> list[dict]:
    page = 1
    records: list[dict] = []
    while page <= 10_000:
        payload = _get("/api/v1/ndr", {"page": page, "page_size": 100})
        items = payload.get("data") or []
        records.extend(item for item in items if isinstance(item, dict))
        pagination = payload.get("pagination") or {}
        pages = int(pagination.get("pages") or page)
        if page >= pages or not items:
            break
        page += 1
    return records


def refresh_ndr_mirror(db: Session, force: bool = False) -> dict:
    global _last_ndr_refresh
    settings = get_settings()
    if not is_configured():
        return {"refreshed": False, "reason": "not_configured"}
    if not force and monotonic() - _last_ndr_refresh < settings.central_courier_ndr_refresh_seconds:
        return {"refreshed": False, "reason": "cached"}
    with _refresh_lock:
        if not force and monotonic() - _last_ndr_refresh < settings.central_courier_ndr_refresh_seconds:
            return {"refreshed": False, "reason": "cached"}
        rows = _all_ndr_records()
        _clear_ndr_records(db)
        mappings = []
        for index, item in enumerate(rows, start=1):
            record = _tracking_record(item, index)
            record.pop("id", None)
            mappings.append(record)
        if mappings:
            db.bulk_insert_mappings(NdrTrackingRecord, mappings)
        db.flush()
        record_daily_snapshot(db, "Central Courier API")
        db.commit()
        _last_ndr_refresh = monotonic()
        return {"refreshed": True, "records": len(mappings), "date": date.today().isoformat()}
