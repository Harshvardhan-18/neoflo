import pytest
from starlette.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_retention_purge_no_old_data():
    """Retention purge on an empty DB or no expired data returns 0 purged."""
    response = client.post("/api/v1/admin/retention/purge?retention_days=30")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["retention_days"] == 30
    assert isinstance(data["purged_sessions"], int)

def test_retention_purge_custom_days():
    """Retention purge accepts custom retention_days parameter."""
    response = client.post("/api/v1/admin/retention/purge?retention_days=7")
    assert response.status_code == 200
    data = response.json()
    assert data["retention_days"] == 7

def test_retention_purge_invalid_days():
    """Retention purge rejects days < 1."""
    response = client.post("/api/v1/admin/retention/purge?retention_days=0")
    assert response.status_code == 422
