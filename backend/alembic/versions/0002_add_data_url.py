"""add data_url to screenshots

Revision ID: 0002_add_data_url
Revises: 0001_initial_schema
Create Date: 2026-07-30
"""
from alembic import op
import sqlalchemy as sa

revision = '0002_add_data_url'
down_revision = '0001_initial_schema'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('screenshots', sa.Column('data_url', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('screenshots', 'data_url')
