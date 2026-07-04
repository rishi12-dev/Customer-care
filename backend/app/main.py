from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address
from starlette.responses import JSONResponse
from app.config.database import SessionLocal
from app.config.settings import get_settings
from app.controllers import auth_controller, pincode_controller, portal_controller, tracking_controller, upload_controller, user_controller
from app.middleware.csrf import CSRFMiddleware
from app.middleware.security import SecurityHeadersMiddleware
from app.services.excel_service import delete_automatic_backups
from app.services.bootstrap import create_schema, seed_initial_data


settings = get_settings()
limiter = Limiter(key_func=get_remote_address, default_limits=["120/minute"])
allowed_origins = list(
    dict.fromkeys(
        [
            *settings.cors_origins,
            "https://customercare-3795c.web.app",
            "https://customercare-3795c.firebaseapp.com",
        ]
    )
)

app = FastAPI(title=settings.app_name, version="1.0.0")
app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(CSRFMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-CSRF-Token"],
)


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request, exc):
    return JSONResponse(status_code=429, content={"detail": "Too many requests. Please try again shortly."})


@app.on_event("startup")
def startup():
    create_schema()
    db = SessionLocal()
    try:
        seed_initial_data(db)
        if delete_automatic_backups(db):
            db.commit()
    finally:
        db.close()


@app.get("/health")
def health():
    return {"status": "ok", "app": settings.app_name}


app.include_router(auth_controller.router)
app.include_router(upload_controller.router)
app.include_router(pincode_controller.router)
app.include_router(tracking_controller.router)
app.include_router(portal_controller.router)
app.include_router(user_controller.router)
