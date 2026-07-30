import uuid
from datetime import datetime, timezone
from typing import Optional, Any, Dict
from sqlalchemy import String, Text, Integer, Float, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

class BrowsingSession(Base):
    """
    Renamed from Session to BrowsingSession to avoid collision with SQLAlchemy's Session/AsyncSession.
    Table name remains 'sessions'.
    """
    __tablename__ = "sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    install_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    events: Mapped[list["Event"]] = relationship("Event", back_populates="session", cascade="all, delete-orphan")
    screenshots: Mapped[list["Screenshot"]] = relationship("Screenshot", back_populates="session", cascade="all, delete-orphan")


class Event(Base):
    __tablename__ = "events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False)
    type: Mapped[str] = mapped_column(String(50), nullable=False)  # navigation, click, scroll, tab_switch, focus, idle
    url: Mapped[str] = mapped_column(Text, nullable=False)
    domain: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    tab_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    
    # Python attribute 'event_metadata' mapped to DB column 'metadata' to avoid Base.metadata collision
    event_metadata: Mapped[Optional[Dict[str, Any]]] = mapped_column("metadata", JSONB, nullable=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    session: Mapped["BrowsingSession"] = relationship("BrowsingSession", back_populates="events")
    screenshots: Mapped[list["Screenshot"]] = relationship("Screenshot", back_populates="event")


class Screenshot(Base):
    __tablename__ = "screenshots"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False)
    event_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("events.id", ondelete="SET NULL"), nullable=True)
    storage_path: Mapped[str] = mapped_column(Text, nullable=False)
    domain: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    captured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    session: Mapped["BrowsingSession"] = relationship("BrowsingSession", back_populates="screenshots")
    event: Mapped[Optional["Event"]] = relationship("Event", back_populates="screenshots")
    summaries: Mapped[list["AISummary"]] = relationship("AISummary", back_populates="screenshot", cascade="all, delete-orphan")


class AISummary(Base):
    __tablename__ = "ai_summaries"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    screenshot_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("screenshots.id", ondelete="CASCADE"), nullable=False)
    model: Mapped[str] = mapped_column(String(100), nullable=False)
    summary_text: Mapped[str] = mapped_column(Text, nullable=False)
    tags: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB, nullable=True)
    confidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    screenshot: Mapped["Screenshot"] = relationship("Screenshot", back_populates="summaries")


class PrivacyRule(Base):
    __tablename__ = "privacy_rules"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    domain: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    action: Mapped[str] = mapped_column(String(20), nullable=False, default="block")  # block, allow
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
