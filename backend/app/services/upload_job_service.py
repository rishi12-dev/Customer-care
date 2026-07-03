from concurrent.futures import ThreadPoolExecutor
from threading import Lock
from uuid import uuid4
from app.config.database import SessionLocal
from app.models.entities import User
from app.services.excel_service import commit_upload


_executor = ThreadPoolExecutor(max_workers=1)
_jobs: dict[str, dict] = {}
_lock = Lock()


def _set_job(job_id: str, data: dict) -> None:
    with _lock:
        _jobs[job_id] = {**_jobs.get(job_id, {}), **data}


def get_upload_job(job_id: str) -> dict | None:
    with _lock:
        job = _jobs.get(job_id)
        return None if job is None else dict(job)


def start_upload_job(content: bytes, filename: str, user_id: int, ip_address: str | None) -> str:
    job_id = uuid4().hex
    _set_job(
        job_id,
        {
            "job_id": job_id,
            "status": "processing",
            "records": 0,
            "duration_ms": 0,
            "errors": [],
            "warnings": ["Upload is processing. Large files can take a few minutes."],
            "backup_id": 0,
        },
    )
    _executor.submit(_run_upload_job, job_id, content, filename, user_id, ip_address)
    return job_id


def _run_upload_job(job_id: str, content: bytes, filename: str, user_id: int, ip_address: str | None) -> None:
    db = SessionLocal()
    try:
        user = db.get(User, user_id)
        if not user:
            raise ValueError("Upload user not found")
        result = commit_upload(db, content, filename, user, ip_address)
        _set_job(job_id, {"status": "completed", **result})
    except Exception as exc:
        db.rollback()
        _set_job(
            job_id,
            {
                "status": "failed",
                "records": 0,
                "duration_ms": 0,
                "errors": [str(exc) or exc.__class__.__name__],
                "warnings": [],
                "backup_id": 0,
            },
        )
    finally:
        db.close()
