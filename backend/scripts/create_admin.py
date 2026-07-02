import getpass
from app.config.database import SessionLocal
from app.models.entities import User, UserRole
from app.utils.security import hash_password


def main():
    email = input("Admin email: ").strip()
    name = input("Full name: ").strip()
    password = getpass.getpass("Password: ")
    db = SessionLocal()
    try:
        if db.query(User).filter(User.email == email).first():
            raise SystemExit("User already exists")
        db.add(User(email=email, full_name=name, hashed_password=hash_password(password), role=UserRole.admin))
        db.commit()
        print("Admin user created")
    finally:
        db.close()


if __name__ == "__main__":
    main()
