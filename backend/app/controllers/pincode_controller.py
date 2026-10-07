from datetime import date
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.api.dependencies import current_user, require_admin
from app.config.database import get_db
from app.models.entities import User
from app.schemas.dto import (
    BulkPincodeSearchRequest,
    PincodeBulkSearchResponse,
    PincodeBulkToggleRequest,
    PincodeSearchResponse,
    PincodeServiceRead,
    PincodeToggleRequest,
    UploadCommitResponse,
    UploadPreview,
)
from app.services.pincode_service import (
    bulk_search_pincode_services,
    export_pincode_services_excel,
    preview_pincode_files,
    replace_pincode_services,
    search_pincode_services,
    set_pincode_all_active,
    toggle_pincode_service_active,
)


router = APIRouter(prefix="/pincodes", tags=["pincodes"])


def _read_files(files: list[UploadFile]) -> list[tuple[str, bytes]]:
    if not files:
        raise HTTPException(status_code=400, detail="Upload at least one Excel file")
    payload: list[tuple[str, bytes]] = []
    for file in files:
        if not file.filename.lower().endswith((".xlsx", ".xls")):
            raise HTTPException(status_code=400, detail=f"{file.filename}: upload an Excel file with .xlsx or .xls extension")
        content = file.file.read()
        if not content:
            raise HTTPException(status_code=400, detail=f"{file.filename}: uploaded file is empty")
        payload.append((file.filename, content))
    return payload


@router.get("/search", response_model=PincodeSearchResponse)
def search(q: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return search_pincode_services(db, q)


@router.post("/bulk-search", response_model=PincodeBulkSearchResponse)
def bulk_search(payload: BulkPincodeSearchRequest, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return bulk_search_pincode_services(db, payload.queries)


@router.patch("/{service_id}/toggle-active", response_model=PincodeServiceRead)
@router.post("/{service_id}/toggle-active", response_model=PincodeServiceRead)
def toggle_active(service_id: int, payload: PincodeToggleRequest | None = None, user: User = Depends(current_user), db: Session = Depends(get_db)):
    active_val = payload.active if payload else None
    return toggle_pincode_service_active(db, service_id, active_val)


@router.post("/bulk-toggle", response_model=list[PincodeServiceRead])
def bulk_toggle(payload: PincodeBulkToggleRequest, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return set_pincode_all_active(db, payload.pincode, payload.active)


@router.get("/export")
def export_excel(user: User = Depends(current_user), db: Session = Depends(get_db)):
    buffer = export_pincode_services_excel(db)
    filename = f"PincodeServices_Export_{date.today().isoformat()}.xlsx"
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/preview", response_model=UploadPreview)
def preview(files: list[UploadFile] = File(...), user: User = Depends(require_admin)):
    return preview_pincode_files(_read_files(files))


@router.post("/import", response_model=UploadCommitResponse)
def import_pincodes(files: list[UploadFile] = File(...), user: User = Depends(require_admin), db: Session = Depends(get_db)):
    result = replace_pincode_services(db, _read_files(files))
    return {**result, "backup_id": 0}
