"""adult confirmation

Revision ID: f4b8c2a6d1e9
Revises: e2a9d4c1b7f3
Create Date: 2026-10-31 14:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f4b8c2a6d1e9"
down_revision: str | Sequence[str] | None = "e2a9d4c1b7f3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Record when each account confirmed it is 18 or older. Existing accounts start unconfirmed."""
    op.add_column(
        "users",
        sa.Column("adult_confirmed_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    """Remove the 18+ record."""
    op.drop_column("users", "adult_confirmed_at")
