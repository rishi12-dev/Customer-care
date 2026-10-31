from time import perf_counter
from sqlalchemy import or_
from sqlalchemy.orm import Session
from app.models.entities import AuditAction, Order, SearchHistory, User
from app.services.audit_service import audit
from app.services.central_courier_service import CentralCourierError, is_configured, search_shipments


def detect_query_type(query: str) -> str:
    cleaned = query.strip()
    digits = "".join(ch for ch in cleaned if ch.isdigit())
    if len(digits) >= 10 and digits == cleaned.replace(" ", ""):
        return "phone"
    if cleaned.upper().startswith(("AWB", "DKT", "DOC")):
        return "docket"
    if any(ch.isalpha() for ch in cleaned) and any(ch.isdigit() for ch in cleaned):
        return "order_or_docket"
    return "universal"


def search_orders(db: Session, query: str, user: User, ip_address: str | None) -> dict:
    started = perf_counter()
    term = query.strip()
    like = f"%{term}%"
    source = "database"
    if is_configured():
        try:
            results = search_shipments(term)
            source = "central_courier_api"
        except CentralCourierError:
            results = []
            source = "central_courier_api_unavailable"
    else:
        results = (
            db.query(Order)
            .filter(or_(Order.order_no.ilike(like), Order.docket_number.ilike(like), Order.customer_phone_number.ilike(like), Order.alt_no.ilike(like)))
            .order_by(Order.id.desc())
            .limit(50)
            .all()
        )
    detected = detect_query_type(term)
    db.add(SearchHistory(user_id=user.id, query=term, detected_type=detected, result_count=len(results)))
    audit(db, user, AuditAction.search, ip_address, {"query": term, "results": len(results)})
    db.commit()
    return {"query": term, "detected_type": detected, "duration_ms": int((perf_counter() - started) * 1000), "results": results, "source": source}
