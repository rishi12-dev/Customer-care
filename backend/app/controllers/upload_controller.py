from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from sqlalchemy.orm import Session
from app.api.dependencies import require_admin, request_ip
from app.config.database import get_db
from app.models.entities import User
from app.schemas.dto import UploadCommitResponse, UploadPreview
from app.services.excel_service import commit_upload, preview_excel


router = APIRouter(prefix="/upload", tags=["upload"])


def _read_excel_file(file: UploadFile) -> bytes:
    if not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Upload an Excel file with .xlsx or .xls extension")
    content = file.file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")
    return content


@router.post("/preview", response_model=UploadPreview)
def preview(file: UploadFile = File(...), user: User = Depends(require_admin)):
    return preview_excel(_read_excel_file(file))


@router.post("", response_model=UploadCommitResponse)
def upload(request: Request, file: UploadFile = File(...), user: User = Depends(require_admin), db: Session = Depends(get_db)):
    result = commit_upload(db, _read_excel_file(file), file.filename, user, request_ip(request))
    if result["errors"]:
        raise HTTPException(status_code=400, detail=result)
    return result
