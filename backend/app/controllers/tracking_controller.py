from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.api.dependencies import require_admin
from app.config.database import get_db
from app.models.entities import User
from app.schemas.dto import TrackingSyncResponse
from app.services.delhivery_service import sync_delhivery_orders


router = APIRouter(prefix="/tracking", tags=["tracking"])


@router.post("/delhivery/sync", response_model=TrackingSyncResponse)
def sync_delhivery(limit: int = Query(default=200, ge=1, le=1000), admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    try:
        return sync_delhivery_orders(db, limit)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
