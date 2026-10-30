"""encouragement flag

Revision ID: c7e1b2d9f0a4
Revises: 5a8d734ace61
Create Date: 2026-10-30 15:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c7e1b2d9f0a4"
down_revision: str | Sequence[str] | None = "5a8d734ace61"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add the buddy encouragement switch. Existing users start with it on."""
    op.add_column(
        "users",
        sa.Column(
            "encouragement_enabled",
            sa.Boolean(),
            server_default=sa.text("true"),
            nullable=False,
        ),
    )


def downgrade() -> None:
    """Remove the buddy encouragement switch."""
    op.drop_column("users", "encouragement_enabled")
