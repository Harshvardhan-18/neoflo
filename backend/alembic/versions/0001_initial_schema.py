"""Initial Schema Migration

Revision ID: 0001_initial_schema
Revises: 
Create Date: 2026-07-30 20:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '0001_initial_schema'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # 1. sessions table
    op.create_table(
        'sessions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('install_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('ended_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(op.f('ix_sessions_install_id'), 'sessions', ['install_id'], unique=False)

    # 2. events table
    op.create_table(
        'events',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('session_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('sessions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('type', sa.String(length=50), nullable=False),
        sa.Column('url', sa.Text(), nullable=False),
        sa.Column('domain', sa.String(length=255), nullable=False),
        sa.Column('tab_id', sa.Integer(), nullable=True),
        sa.Column('metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('occurred_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(op.f('ix_events_domain'), 'events', ['domain'], unique=False)

    # 3. screenshots table
    op.create_table(
        'screenshots',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('session_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('sessions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('event_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('events.id', ondelete='SET NULL'), nullable=True),
        sa.Column('storage_path', sa.Text(), nullable=False),
        sa.Column('domain', sa.String(length=255), nullable=False),
        sa.Column('captured_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(op.f('ix_screenshots_domain'), 'screenshots', ['domain'], unique=False)

    # 4. ai_summaries table
    op.create_table(
        'ai_summaries',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('screenshot_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('screenshots.id', ondelete='CASCADE'), nullable=False),
        sa.Column('model', sa.String(length=100), nullable=False),
        sa.Column('summary_text', sa.Text(), nullable=False),
        sa.Column('tags', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('confidence', sa.Float(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )

    # 5. privacy_rules table
    op.create_table(
        'privacy_rules',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('domain', sa.String(length=255), nullable=False),
        sa.Column('action', sa.String(length=20), nullable=False, server_default='block'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(op.f('ix_privacy_rules_domain'), 'privacy_rules', ['domain'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_privacy_rules_domain'), table_name='privacy_rules')
    op.drop_table('privacy_rules')
    op.drop_table('ai_summaries')
    op.drop_index(op.f('ix_screenshots_domain'), table_name='screenshots')
    op.drop_table('screenshots')
    op.drop_index(op.f('ix_events_domain'), table_name='events')
    op.drop_table('events')
    op.drop_index(op.f('ix_sessions_install_id'), table_name='sessions')
    op.drop_table('sessions')
