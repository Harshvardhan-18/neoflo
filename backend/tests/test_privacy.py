import pytest
import uuid
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_privacy_rules_crud():
    install_id = str(uuid.uuid4())
    headers = {"X-Install-Key": install_id}
    test_domain = f"test-{uuid.uuid4().hex[:6]}.com"

    # 1. Create rule
    create_resp = client.post(
        "/api/v1/privacy/rules",
        json={"domain": test_domain, "action": "block"},
        headers=headers
    )
    assert create_resp.status_code == 201
    rule_data = create_resp.json()
    assert rule_data["domain"] == test_domain
    assert rule_data["action"] == "block"
    rule_id = rule_data["id"]

    # 2. Duplicate domain creation should return 409 Conflict
    dup_resp = client.post(
        "/api/v1/privacy/rules",
        json={"domain": test_domain, "action": "block"},
        headers=headers
    )
    assert dup_resp.status_code == 409

    # 3. List rules
    list_resp = client.get("/api/v1/privacy/rules", headers=headers)
    assert list_resp.status_code == 200
    domains = [r["domain"] for r in list_resp.json()]
    assert test_domain in domains

    # 4. Delete rule
    del_resp = client.delete(f"/api/v1/privacy/rules/{rule_id}", headers=headers)
    assert del_resp.status_code == 204

    # 5. Delete non-existent rule should return 404
    del_404_resp = client.delete(f"/api/v1/privacy/rules/{rule_id}", headers=headers)
    assert del_404_resp.status_code == 404
