import pytest
import uuid
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient
from sqlalchemy import select
from app.main import app
from app.database import async_session_maker, engine
from app.models import Screenshot, AISummary, BrowsingSession
from app.services.processor import process_screenshot_summary_background

# Minimal 1x1 white JPEG base64 data URL
TEST_JPEG_DATA_URL = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA="

def test_screenshot_upload_endpoint():
    client = TestClient(app)
    session_id = str(uuid.uuid4())
    screenshot_id = str(uuid.uuid4())
    install_id = str(uuid.uuid4())

    payload = {
        "id": screenshot_id,
        "session_id": session_id,
        "event_id": None,
        "data_url": TEST_JPEG_DATA_URL,
        "domain": "example.com",
        "url": "https://example.com/demo",
        "captured_at": "2026-07-30T21:40:00.000Z"
    }

    response = client.post(
        "/api/v1/screenshots",
        json=payload,
        headers={"X-Install-Key": install_id}
    )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["screenshot_id"] == screenshot_id

@pytest.mark.asyncio
async def test_vision_processor_db_persistence():
    await engine.dispose()  # Clear pooled connections across loops

    session_id = uuid.uuid4()
    screenshot_id = uuid.uuid4()
    install_id = uuid.uuid4()

    async with async_session_maker() as db:
        # Create prerequisite browsing session & screenshot
        db.add(BrowsingSession(id=session_id, install_id=install_id))
        db.add(Screenshot(
            id=screenshot_id,
            session_id=session_id,
            storage_path=f"screenshots/{session_id}/{screenshot_id}.jpg",
            domain="example.com"
        ))
        await db.commit()

    # Mock the vision API call so the test is network-free and always succeeds
    mock_analysis = {
        "activity_type": "browsing",
        "summary": "User is viewing example.com for testing purposes.",
        "detected_ui_elements": ["header", "main"],
        "tags": ["test", "example"],
        "confidence": 0.95,
    }
    with patch(
        "app.services.processor.analyze_screenshot_with_gemini",
        new=AsyncMock(return_value=mock_analysis),
    ):
        await process_screenshot_summary_background(
            screenshot_id=screenshot_id,
            data_url=TEST_JPEG_DATA_URL,
            domain="example.com",
            url="https://example.com",
        )

    # Verify AI Summary row was persisted to Postgres
    async with async_session_maker() as db:
        stmt = select(AISummary).where(AISummary.screenshot_id == screenshot_id)
        result = await db.execute(stmt)
        summary = result.scalar_one_or_none()

        assert summary is not None
        assert summary.model == "gpt-4o-mini"
        assert summary.summary_text == mock_analysis["summary"]
        assert "activity_type" in summary.tags

    await engine.dispose()
