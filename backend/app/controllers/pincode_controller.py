from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session
from app.api.dependencies import current_user, require_admin
from app.config.database import get_db
from app.models.entities import User
from app.schemas.dto import PincodeSearchResponse, UploadCommitResponse, UploadPreview
from app.services.pincode_service import preview_pincode_files, replace_pincode_services, search_pincode_services


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


@router.post("/preview", response_model=UploadPreview)
def preview(files: list[UploadFile] = File(...), user: User = Depends(require_admin)):
    return preview_pincode_files(_read_files(files))


@router.post("/import", response_model=UploadCommitResponse)
def import_pincodes(files: list[UploadFile] = File(...), user: User = Depends(require_admin), db: Session = Depends(get_db)):
    result = replace_pincode_services(db, _read_files(files))
    return {**result, "backup_id": 0}
