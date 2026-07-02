from datetime import datetime, timedelta, timezone
from secrets import token_urlsafe
from jose import JWTError, jwt
from passlib.context import CryptContext
from app.config.settings import get_settings


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, hashed_password: str) -> bool:
    return pwd_context.verify(password, hashed_password)


def create_token(subject: str, role: str, minutes: int, secret: str, token_type: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {"sub": subject, "role": role, "type": token_type, "iat": now, "exp": now + timedelta(minutes=minutes)}
    return jwt.encode(payload, secret, algorithm="HS256")


def create_access_token(subject: str, role: str) -> str:
    settings = get_settings()
    return create_token(subject, role, settings.access_token_expire_minutes, settings.jwt_secret_key, "access")


def create_refresh_token(subject: str, role: str) -> str:
    settings = get_settings()
    minutes = settings.refresh_token_expire_days * 24 * 60
    return create_token(subject, role, minutes, settings.jwt_refresh_secret_key, "refresh")


def decode_token(token: str, secret: str, expected_type: str) -> dict:
    try:
        payload = jwt.decode(token, secret, algorithms=["HS256"])
    except JWTError as exc:
        raise ValueError("Invalid token") from exc
    if payload.get("type") != expected_type:
        raise ValueError("Invalid token type")
    return payload


def new_csrf_token() -> str:
    return token_urlsafe(32)
