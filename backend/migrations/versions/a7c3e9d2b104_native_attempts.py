"""native sign-in attempts

Revision ID: a7c3e9d2b104
Revises: f4b8c2a6d1e9
Create Date: 2026-11-01 09:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a7c3e9d2b104"
down_revision: str | Sequence[str] | None = "f4b8c2a6d1e9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create the table that binds each native login to the attempt that started it."""
    op.create_table(
        "native_attempts",
        sa.Column("attempt_hash", sa.String(length=64), nullable=False),
        sa.Column("nonce", sa.String(length=64), nullable=False),
        sa.Column("state", sa.String(length=16), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "state IN ('pending', 'consumed', 'cancelled')", name="native_attempts_state_known"
        ),
        sa.PrimaryKeyConstraint("attempt_hash"),
    )


def downgrade() -> None:
    """Drop the attempt table. Pending attempts are not needed after this point."""
    op.drop_table("native_attempts")
