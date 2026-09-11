import re

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.entities import NdrTrackingRecord, Order


def _raw_first(raw: dict, labels: list[str]) -> str | None:
    normalized = {re.sub(r"[^a-z0-9]", "", str(key).lower()): value for key, value in raw.items()}
    for label in labels:
        value = normalized.get(re.sub(r"[^a-z0-9]", "", label.lower()))
        if value is not None and str(value).strip():
            return str(value).strip()
    return None


def _status_group(status: str | None) -> str:
    value = str(status or "").lower()
    if "refund" in value:
        return "Refunded"
    if "cancel" in value:
        return "Cancelled"
    if "out for delivery" in value or re.search(r"\bofd\b", value):
        return "Out for Delivery"
    if "deliver" in value:
        return "Delivered"
    if "transit" in value:
        return "In Transit"
    if any(term in value for term in ("ship", "pickup", "manifest")):
        return "Shipped"
    return "Other"


def _shipping_day(raw: dict) -> int | None:
    value = _raw_first(raw, ["ShippingDate", "Shipping Date"])
    if not value:
        return None
    match = re.match(r"\s*(?:\d{4}[-/.])?(\d{1,2})", value)
    if match:
        return int(match.group(1)) if value.startswith("20") is False else int(value[8:10])
    match = re.match(r"\s*(\d{1,2})[-/.]", value)
    return int(match.group(1)) if match else None


def _summary_reply(db: Session, start_day: int | None = None, end_day: int | None = None) -> dict:
    records = db.query(NdrTrackingRecord.id, NdrTrackingRecord.upload_filename, NdrTrackingRecord.row_number, NdrTrackingRecord.order_no, NdrTrackingRecord.raw_data).order_by(NdrTrackingRecord.id.asc()).all()
    latest_rows: dict[tuple[str, int, str], dict] = {}
    for _, filename, row_number, order_no, raw in records:
        raw = raw or {}
        stable_order = order_no or _raw_first(raw, ["OrderNo", "Order No"]) or ""
        latest_rows[(filename or "", row_number or 0, stable_order)] = raw

    selected = []
    for raw in latest_rows.values():
        day = _shipping_day(raw)
        if start_day is not None and (day is None or day < start_day or day > (end_day or start_day)):
            continue
        selected.append(raw)
    counts = {"Delivered": 0, "Shipped": 0, "Refunded": 0, "Cancelled": 0}
    for raw in selected:
        oms_status = _raw_first(raw, ["Current status", "OMS Status"])
        courier_status = _raw_first(raw, ["Courier remark", "Courier remarks"])
        terminal_status = _status_group(oms_status)
        status = terminal_status if terminal_status in {"Refunded", "Cancelled"} else _status_group(courier_status or oms_status)
        if status == "Delivered":
            counts["Delivered"] += 1
        elif status in {"Shipped", "In Transit", "Out for Delivery"}:
            counts["Shipped"] += 1
        elif status in {"Refunded", "Cancelled"}:
            counts[status] += 1

    range_label = f"ShippingDate day {start_day}-{end_day}" if start_day is not None else "all uploaded rows"
    return {
        "found": bool(selected),
        "message": f"Here is the uploaded-file summary for {range_label}.",
        "details": {"Total Orders": str(len(selected)), "Shipped / In Transit / OFD": str(counts["Shipped"]), "Delivered": str(counts["Delivered"]), "Refunded": str(counts["Refunded"]), "Cancelled": str(counts["Cancelled"])},
    }


def shipment_assistant_reply(db: Session, query: str) -> dict:
    term = query.strip()
    if not term:
        return {"found": False, "message": "Please share an order number or docket number. You can also type Summary or 1-5 Summary for uploaded-file counts."}

    normalized_query = term.lower()
    range_match = re.search(r"\b(\d{1,2})\s*(?:to|-)\s*(\d{1,2})\b", normalized_query)
    if "summary" in normalized_query or "overview" in normalized_query or range_match:
        if range_match:
            return _summary_reply(db, int(range_match.group(1)), int(range_match.group(2)))
        return _summary_reply(db)

    like = f"%{term}%"
    order = (
        db.query(Order)
        .filter(or_(Order.order_no.ilike(like), Order.docket_number.ilike(like)))
        .order_by(Order.id.desc())
        .first()
    )
    tracking = (
        db.query(NdrTrackingRecord)
        .filter(or_(NdrTrackingRecord.order_no.ilike(like), NdrTrackingRecord.docket_number.ilike(like)))
        .order_by(NdrTrackingRecord.id.desc())
        .first()
    )

    if not order and not tracking:
        return {"found": False, "message": f"No uploaded order or tracking record was found for {term}. Please check the order number or docket number and try again."}

    details: dict[str, str] = {}
    lines: list[str] = []
    if order:
        details.update(
            {
                "Order No": order.order_no,
                "Docket No": order.docket_number,
                "Courier": order.shipment,
                "Current Status": order.current_status,
                "Customer": order.customer_name,
                "Phone": order.customer_phone_number,
                "Expected Delivery": order.expected_delivery.isoformat() if order.expected_delivery else "N/A",
                "Delivered On": order.delivery_date.isoformat() if order.delivery_date else "N/A",
            }
        )
        lines.append(f"Order {order.order_no} is {order.current_status} with {order.shipment}.")
        if order.remark:
            details["Latest Remark"] = order.remark

    if tracking:
        raw = tracking.raw_data or {}
        courier_remark = _raw_first(raw, ["Courier remark", "Courier remarks"])
        details["Latest Tracking Status"] = str(courier_remark or tracking.status or "N/A")
        details["Tracking Update"] = tracking.event_time or "N/A"
        details["OUR EDD / Expected Delivery"] = _raw_first(raw, ["OUR EDD", "Our EDD", "Expected Delivery"]) or details.get("Expected Delivery", "N/A")
        if tracking.remark:
            details["Tracking Remark"] = tracking.remark
        if not order:
            details["Order No"] = tracking.order_no or "N/A"
            details["Docket No"] = tracking.docket_number or "N/A"
        lines.append(f"Latest uploaded courier update: {courier_remark or tracking.status or 'N/A'}.")

    return {"found": True, "message": " ".join(lines), "details": details}
