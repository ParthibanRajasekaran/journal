"""other meal type

Revision ID: e2a9d4c1b7f3
Revises: c7e1b2d9f0a4
Create Date: 2026-10-30 18:00:00.000000

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e2a9d4c1b7f3"
down_revision: str | Sequence[str] | None = "c7e1b2d9f0a4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

BEFORE = "meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')"
AFTER = "meal_type IN ('breakfast', 'lunch', 'dinner', 'snack', 'other')"


def upgrade() -> None:
    """Allow drinks and other intake as its own meal type."""
    op.drop_constraint("meal_type_allowed", "meals", type_="check")
    op.create_check_constraint("meal_type_allowed", "meals", AFTER)


def downgrade() -> None:
    """Remove the other meal type. Rows using it must be moved first."""
    op.execute("UPDATE meals SET meal_type = 'snack' WHERE meal_type = 'other'")
    op.drop_constraint("meal_type_allowed", "meals", type_="check")
    op.create_check_constraint("meal_type_allowed", "meals", BEFORE)
