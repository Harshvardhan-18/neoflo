import pytest
import uuid
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_activity_timeline_unauthorized():
    response = client.get("/api/v1/activity/timeline")
    assert response.status_code == 401
    assert "X-Install-Key header missing" in response.json()["detail"]

def test_activity_timeline_happy_path():
    install_id = str(uuid.uuid4())
    session_id = str(uuid.uuid4())
    event_id = str(uuid.uuid4())

    # Ingest test event
    ingest_payload = {
        "events": [
            {
                "id": event_id,
                "session_id": session_id,
                "type": "navigation",
                "url": "https://example.com/home",
                "domain": "example.com",
                "tab_id": 1,
                "metadata": {"title": "Example Home"},
                "occurred_at": "2026-07-30T21:00:00.000Z"
            }
        ]
    }
    client.post("/api/v1/events/batch", json=ingest_payload, headers={"X-Install-Key": install_id})

    # Query timeline
    response = client.get(
        "/api/v1/activity/timeline?page=1&limit=10",
        headers={"X-Install-Key": install_id}
    )

    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 1
    assert data["page"] == 1
    assert len(data["items"]) >= 1
    assert data["items"][0]["session_id"] == session_id

def test_activity_timeline_domain_filter():
    install_id = str(uuid.uuid4())
    response = client.get(
        "/api/v1/activity/timeline?domain=nonexistent-domain.com",
        headers={"X-Install-Key": install_id}
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) == 0
