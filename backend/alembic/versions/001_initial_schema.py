"""initial schema

Revision ID: 001
Revises: 
Create Date: 2026-05-08

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'users',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('email', sa.String(255), unique=True, nullable=False, index=True),
        sa.Column('password_hash', sa.String(255), nullable=False),
        sa.Column('nickname', sa.String(100), nullable=False),
        sa.Column('avatar', sa.String(500), nullable=True),
        sa.Column('role', sa.String(20), server_default='user'),
        sa.Column('status', sa.String(20), server_default='active'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        'workflow_templates',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('cover_image', sa.String(500), nullable=True),
        sa.Column('workflow_json', sa.Text, nullable=False),
        sa.Column('form_schema', sa.Text, nullable=True),
        sa.Column('input_nodes', sa.Text, nullable=True),
        sa.Column('output_nodes', sa.Text, nullable=True),
        sa.Column('is_public', sa.Boolean, server_default='false'),
        sa.Column('status', sa.String(20), server_default='draft'),
        sa.Column('run_count', sa.Integer, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        'workflow_runs',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('template_id', sa.String(36), sa.ForeignKey('workflow_templates.id'), nullable=False),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('input_data', sa.Text, nullable=True),
        sa.Column('status', sa.String(20), server_default='pending'),
        sa.Column('prompt_id', sa.String(100), nullable=True),
        sa.Column('result_data', sa.Text, nullable=True),
        sa.Column('credits_consumed', sa.Integer, server_default='0'),
        sa.Column('error_message', sa.Text, nullable=True),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        'credit_accounts',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id'), unique=True, nullable=False),
        sa.Column('balance', sa.Integer, server_default='0'),
        sa.Column('total_recharged', sa.Integer, server_default='0'),
        sa.Column('total_consumed', sa.Integer, server_default='0'),
        sa.Column('total_gifted', sa.Integer, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        'credit_transactions',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('type', sa.String(20), nullable=False),
        sa.Column('amount', sa.Integer, nullable=False),
        sa.Column('balance_after', sa.Integer, nullable=False),
        sa.Column('reference_type', sa.String(50), nullable=False),
        sa.Column('reference_id', sa.String(100), nullable=False),
        sa.Column('description', sa.String(500), server_default=''),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        'workflow_pricings',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('template_id', sa.String(36), sa.ForeignKey('workflow_templates.id'), unique=True, nullable=False),
        sa.Column('credits_per_run', sa.Integer, server_default='1'),
        sa.Column('is_active', sa.Boolean, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        'admin_audit_logs',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('admin_id', sa.String(36), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('action', sa.String(100), nullable=False),
        sa.Column('target_type', sa.String(50), nullable=False),
        sa.Column('target_id', sa.String(100), nullable=False),
        sa.Column('detail', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table('admin_audit_logs')
    op.drop_table('workflow_pricings')
    op.drop_table('credit_transactions')
    op.drop_table('credit_accounts')
    op.drop_table('workflow_runs')
    op.drop_table('workflow_templates')
    op.drop_table('users')
