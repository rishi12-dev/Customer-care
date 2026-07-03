from sqlalchemy import inspect, text
from sqlalchemy.orm import Session
from app.config.database import Base, engine
from app.config.settings import get_settings
from app.models.entities import AppSetting, User, UserRole
from app.utils.security import hash_password


def create_schema() -> None:
    Base.metadata.create_all(bind=engine)
    columns = {column["name"] for column in inspect(engine).get_columns("users")}
    if "avatar_data_url" not in columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE users ADD COLUMN avatar_data_url TEXT"))


def seed_initial_data(db: Session) -> None:
    settings = get_settings()
    existing = db.query(User).filter(User.email == settings.initial_admin_email).first()
    if not existing:
        db.add(
            User(
                email=settings.initial_admin_email,
                full_name="CourierOps Administrator",
                hashed_password=hash_password(settings.initial_admin_password),
                role=UserRole.admin,
                is_active=True,
            )
        )
    if not db.get(AppSetting, "portal"):
        db.add(AppSetting(key="portal", value={"company_name": "CourierOps", "theme": "system"}))
    db.commit()
