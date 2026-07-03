from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from app.api.dependencies import require_admin, request_ip
from app.models.entities import User
from app.schemas.dto import UploadCommitResponse, UploadPreview
from app.services.excel_service import preview_excel
from app.services.upload_job_service import get_upload_job, start_upload_job


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
def upload(request: Request, file: UploadFile = File(...), user: User = Depends(require_admin)):
    job_id = start_upload_job(_read_excel_file(file), file.filename, user.id, request_ip(request))
    job = get_upload_job(job_id)
    return job


@router.get("/jobs/{job_id}", response_model=UploadCommitResponse)
def upload_job(job_id: str, user: User = Depends(require_admin)):
    job = get_upload_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Upload job not found")
    return job
