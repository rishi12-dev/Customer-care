from functools import lru_cache
from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "CourierOps"
    environment: str = "development"
    app_timezone: str = "Asia/Kolkata"
    manual_ndr_only: bool = True
    database_url: str = "postgresql+psycopg://postgres:password@localhost:5432/courierops"
    jwt_secret_key: str
    jwt_refresh_secret_key: str
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    cors_origins: list[str] = ["http://localhost:5173"]
    delhivery_api_token: str | None = None
    delhivery_tracking_url: str = "https://track.delhivery.com/api/v1/packages/json/"
    initial_admin_email: str = "admin@courierops.local"
    initial_admin_password: str = "ChangeMe@12345"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @field_validator("cors_origins", mode="before")
    @classmethod
    def split_origins(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @model_validator(mode="after")
    def require_production_secrets(self):
        if self.environment.casefold() == "production":
            if self.jwt_secret_key.startswith("change-") or self.jwt_refresh_secret_key.startswith("change-"):
                raise ValueError("Production JWT secrets must be replaced with random secrets")
            if self.initial_admin_password == "ChangeMe@12345":
                raise ValueError("Production initial admin password must be replaced")
            if not self.cors_origins:
                raise ValueError("At least one production CORS origin is required")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
