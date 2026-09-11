from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.entities import NdrTrackingRecord, Order


def shipment_assistant_reply(db: Session, query: str) -> dict:
    term = query.strip()
    if not term:
        return {"found": False, "message": "Order number ya docket number share karo, main uploaded data me check karta hoon."}

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
        return {"found": False, "message": f"{term} ke liye uploaded order ya tracking record nahi mila. Order number ya docket number dobara check karo."}

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
        courier_remark = raw.get("Courier remark") or raw.get("Courier Remark")
        details["Latest Tracking Status"] = str(courier_remark or tracking.status or "N/A")
        details["Tracking Update"] = tracking.event_time or "N/A"
        if tracking.remark:
            details["Tracking Remark"] = tracking.remark
        if not order:
            details["Order No"] = tracking.order_no or "N/A"
            details["Docket No"] = tracking.docket_number or "N/A"
        lines.append(f"Latest uploaded courier update: {courier_remark or tracking.status or 'N/A'}.")

    return {"found": True, "message": " ".join(lines), "details": details}
