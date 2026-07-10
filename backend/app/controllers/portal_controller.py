from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.api.dependencies import current_user, require_admin, request_ip
from app.config.database import get_db
from app.models.entities import AppSetting, Backup, Order, PincodeService, SearchHistory, UploadHistory, User
from app.schemas.dto import DashboardResponse, OrderRead, SearchResponse, SettingUpdate
from app.services.excel_service import restore_backup
from app.services.search_service import search_orders


router = APIRouter(tags=["portal"])


@router.get("/dashboard", response_model=DashboardResponse)
def dashboard(user: User = Depends(current_user), db: Session = Depends(get_db)):
    status_rows = db.query(Order.current_status, func.count(Order.id)).group_by(Order.current_status).all()
    status_counts = {str(status or "").lower(): count for status, count in status_rows}
    total = sum(status_counts.values())

    def count_status(name: str) -> int:
        return status_counts.get(name.lower(), 0)

    latest = db.query(UploadHistory).order_by(UploadHistory.created_at.desc()).first()
    courier_wise = [{"name": row[0], "value": row[1]} for row in db.query(Order.shipment, func.count(Order.id)).group_by(Order.shipment).order_by(func.count(Order.id).desc()).limit(10).all()]
    status_wise = [{"name": status, "value": count} for status, count in status_rows]
    daily = [{"date": str(row[0]), "records": row[1]} for row in db.query(func.date(UploadHistory.created_at), func.sum(UploadHistory.records)).group_by(func.date(UploadHistory.created_at)).order_by(func.date(UploadHistory.created_at).desc()).limit(14).all()]
    pincode_total = db.query(func.count(PincodeService.id)).scalar() or 0
    pincode_active = db.query(func.count(PincodeService.id)).filter(PincodeService.active.is_(True)).scalar() or 0
    pincode_unique = db.query(func.count(func.distinct(PincodeService.pincode))).scalar() or 0
    pincode_courier_wise = [{"name": row[0], "value": row[1]} for row in db.query(PincodeService.courier, func.count(PincodeService.id)).group_by(PincodeService.courier).order_by(func.count(PincodeService.id).desc()).limit(10).all()]
    pincode_state_wise = [{"name": row[0] or "Unknown", "value": row[1]} for row in db.query(PincodeService.state, func.count(PincodeService.id)).group_by(PincodeService.state).order_by(func.count(PincodeService.id).desc()).limit(10).all()]
    pincode_warehouse_wise = [{"name": row[0] or "Unknown", "value": row[1]} for row in db.query(PincodeService.warehouse, func.count(PincodeService.id)).group_by(PincodeService.warehouse).order_by(func.count(PincodeService.id).desc()).limit(10).all()]
    pending = max(total - count_status("Delivered"), 0)
    return {
        "total_orders": total,
        "delivered": count_status("Delivered"),
        "pending": pending,
        "in_transit": count_status("In Transit"),
        "ofd": count_status("Out For Delivery"),
        "ndr": count_status("NDR"),
        "rto": count_status("RTO"),
        "delayed": count_status("Delayed"),
        "latest_upload": None if not latest else {"date": latest.created_at, "records": latest.records, "status": latest.status.value},
        "database_status": "connected",
        "courier_wise": courier_wise,
        "status_wise": status_wise,
        "daily_upload_trend": daily,
        "pincode_total": pincode_total,
        "pincode_unique": pincode_unique,
        "pincode_active": pincode_active,
        "pincode_inactive": max(pincode_total - pincode_active, 0),
        "pincode_courier_wise": pincode_courier_wise,
        "pincode_state_wise": pincode_state_wise,
        "pincode_warehouse_wise": pincode_warehouse_wise,
    }


@router.get("/search", response_model=SearchResponse)
def search(request: Request, q: str = Query(min_length=2, max_length=160), user: User = Depends(current_user), db: Session = Depends(get_db)):
    return search_orders(db, q, user, request_ip(request))


@router.get("/orders/{order_id}", response_model=OrderRead)
def order_detail(order_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@router.get("/recent-search")
def recent_search(user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.query(SearchHistory).filter(SearchHistory.user_id == user.id).order_by(SearchHistory.created_at.desc()).limit(10).all()
    return [{"query": row.query, "detected_type": row.detected_type, "result_count": row.result_count, "created_at": row.created_at} for row in rows]


@router.get("/upload-history")
def upload_history(user: User = Depends(require_admin), db: Session = Depends(get_db)):
    rows = db.query(UploadHistory).order_by(UploadHistory.created_at.desc()).limit(100).all()
    return [{"id": row.id, "date": row.created_at.date(), "time": row.created_at.time().strftime("%H:%M:%S"), "uploaded_by": row.uploaded_by.full_name if row.uploaded_by else "Deleted user", "records": row.records, "duration": row.duration_ms, "status": row.status.value, "errors": row.errors, "warnings": row.warnings} for row in rows]


@router.post("/backup")
def manual_backup(request: Request, user: User = Depends(require_admin), db: Session = Depends(get_db)):
    from app.services.excel_service import create_backup
    backup = create_backup(db, user, f"Manual backup {date.today().isoformat()}", request_ip(request))
    db.commit()
    return {"backup_id": backup.id, "records": backup.records}


@router.get("/backup")
def list_backups(user: User = Depends(require_admin), db: Session = Depends(get_db)):
    rows = db.query(Backup).order_by(Backup.created_at.desc()).limit(50).all()
    return [{"id": row.id, "label": row.label, "records": row.records, "created_at": row.created_at} for row in rows]


@router.post("/restore/{backup_id}")
def restore(backup_id: int, request: Request, user: User = Depends(require_admin), db: Session = Depends(get_db)):
    try:
        return restore_backup(db, backup_id, user, request_ip(request))
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.get("/settings")
def get_settings(user: User = Depends(current_user), db: Session = Depends(get_db)):
    setting = db.get(AppSetting, "portal")
    return setting.value if setting else {"company_name": "CourierOps", "theme": "system"}


@router.put("/settings")
def update_settings(payload: SettingUpdate, user: User = Depends(require_admin), db: Session = Depends(get_db)):
    setting = db.get(AppSetting, "portal") or AppSetting(key="portal", value={})
    setting.value = payload.model_dump()
    db.merge(setting)
    db.commit()
    return setting.value
