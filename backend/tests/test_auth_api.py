import os

os.environ.setdefault("DATABASE_URL", "sqlite:///./test_courierops.db")
os.environ.setdefault("JWT_SECRET_KEY", "test_access_secret")
os.environ.setdefault("JWT_REFRESH_SECRET_KEY", "test_refresh_secret")

from fastapi.testclient import TestClient
from app.main import app


def test_health_endpoint():
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
