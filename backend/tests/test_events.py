import pytest
from fastapi.testclient import TestClient
from app.main import app
import uuid

client = TestClient(app)

def test_health_check():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

def test_events_batch_ingestion():
    session_id = str(uuid.uuid4())
    event_id = str(uuid.uuid4())
    install_id = str(uuid.uuid4())

    payload = {
        "events": [
            {
                "id": event_id,
                "session_id": session_id,
                "type": "click",
                "url": "https://example.com/test",
                "domain": "example.com",
                "tab_id": 101,
                "metadata": {
                    "tag": "BUTTON",
                    "selector": "div.container > button#btn-submit"
                },
                "occurred_at": "2026-07-30T21:00:00.000Z"
            }
        ]
    }

    response = client.post(
        "/api/v1/events/batch",
        json=payload,
        headers={"X-Install-Key": install_id}
    )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["count"] == 1
