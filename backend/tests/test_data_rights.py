import pytest
import uuid
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_user_data_export_and_delete():
    install_id = str(uuid.uuid4())
    headers = {"X-Install-Key": install_id}
    session_id = str(uuid.uuid4())
    event_id = str(uuid.uuid4())

    # 1. Ingest test event data
    client.post(
        "/api/v1/events/batch",
        json={
            "events": [
                {
                    "id": event_id,
                    "session_id": session_id,
                    "type": "click",
                    "url": "https://example.com/item",
                    "domain": "example.com",
                    "tab_id": 5,
                    "metadata": {"tag": "BUTTON"},
                    "occurred_at": "2026-07-30T21:30:00.000Z"
                }
            ]
        },
        headers=headers
    )

    # 2. Export user data
    export_resp = client.post("/api/v1/data/export", headers=headers)
    assert export_resp.status_code == 200
    export_data = export_resp.json()
    assert export_data["sessions_count"] >= 1
    assert export_data["events_count"] >= 1

    # 3. Delete user data
    del_resp = client.post("/api/v1/data/delete", headers=headers)
    assert del_resp.status_code == 200
    del_data = del_resp.json()
    assert del_data["status"] == "success"
    assert del_data["deleted_records"]["sessions"] >= 1

    # 4. Verify export returns 0 sessions after deletion
    export_after_resp = client.post("/api/v1/data/export", headers=headers)
    assert export_after_resp.status_code == 200
    assert export_after_resp.json()["sessions_count"] == 0
