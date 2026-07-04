from datetime import datetime
from time import perf_counter
import httpx
from sqlalchemy.orm import Session
from app.config.settings import get_settings
from app.models.entities import Order
from app.services.excel_service import _parse_date, normalize_status


def _chunks(items: list[str], size: int) -> list[list[str]]:
    return [items[index:index + size] for index in range(0, len(items), size)]


def _shipment_items(payload: dict) -> list[dict]:
    data = payload.get("ShipmentData") or payload.get("shipment_data") or []
    items = []
    for item in data:
        shipment = item.get("Shipment") if isinstance(item, dict) else None
        if isinstance(shipment, dict):
            items.append(shipment)
    return items


def _status_text(shipment: dict) -> str | None:
    status = shipment.get("Status")
    if isinstance(status, dict):
        return status.get("Status") or status.get("StatusType") or status.get("Instructions")
    return shipment.get("status") or shipment.get("CurrentStatus")


def _status_remark(shipment: dict) -> str | None:
    status = shipment.get("Status")
    if isinstance(status, dict):
        return status.get("Instructions") or status.get("Status")
    return _status_text(shipment)


def _status_date(shipment: dict):
    status = shipment.get("Status")
    if isinstance(status, dict):
        return _parse_date(status.get("StatusDateTime") or status.get("StatusDate") or status.get("Date"))
    return None


def sync_delhivery_orders(db: Session, limit: int = 200) -> dict:
    settings = get_settings()
    if not settings.delhivery_api_token:
        raise ValueError("DELHIVERY_API_TOKEN is not configured")

    started = perf_counter()
    orders = (
        db.query(Order)
        .filter(Order.shipment.ilike("%delhivery%"))
        .order_by(Order.updated_at.asc())
        .limit(limit)
        .all()
    )
    order_by_waybill = {order.docket_number: order for order in orders if order.docket_number}
    if not order_by_waybill:
        return {"checked": 0, "updated": 0, "errors": [], "duration_ms": 0}

    updated = 0
    errors: list[str] = []
    headers = {"Authorization": f"Token {settings.delhivery_api_token}", "Accept": "application/json"}
    with httpx.Client(timeout=30) as client:
        for waybills in _chunks(list(order_by_waybill.keys()), 50):
            try:
                response = client.get(settings.delhivery_tracking_url, params={"waybill": ",".join(waybills)}, headers=headers)
                response.raise_for_status()
                payload = response.json()
            except Exception as exc:
                errors.append(str(exc))
                continue

            for shipment in _shipment_items(payload):
                waybill = str(shipment.get("AWB") or shipment.get("Waybill") or shipment.get("waybill") or "")
                order = order_by_waybill.get(waybill)
                status_text = _status_text(shipment)
                if not order or not status_text:
                    continue
                normalized = normalize_status(status_text)
                order.current_status = normalized
                order.remark = _status_remark(shipment) or order.remark
                if normalized == "Delivered":
                    order.delivery_date = _status_date(shipment) or order.delivery_date
                expected = _parse_date(shipment.get("ExpectedDeliveryDate") or shipment.get("PromisedDeliveryDate"))
                if expected:
                    order.expected_delivery = expected
                order.updated_at = datetime.utcnow()
                updated += 1

    db.commit()
    return {"checked": len(order_by_waybill), "updated": updated, "errors": errors, "duration_ms": int((perf_counter() - started) * 1000)}
