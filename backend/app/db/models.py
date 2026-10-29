"""Tables for users and meals.

Limits here mirror docs/openapi.yaml. The database enforces them too, so a bug in
application code cannot store an out-of-range value (defence in depth, ADR-006).
"""

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

MEAL_TYPES = ("breakfast", "lunch", "dinner", "snack")
MEAL_SOURCES = ("ai_confirmed", "ai_edited", "manual")


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex}"


def _in_list(column: str, values: tuple[str, ...]) -> str:
    quoted = ", ".join(f"'{value}'" for value in values)
    return f"{column} IN ({quoted})"


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint(
            "target_calories IS NULL OR target_calories BETWEEN 800 AND 6000",
            name="target_calories_range",
        ),
        CheckConstraint(
            "target_protein_g IS NULL OR target_protein_g BETWEEN 0 AND 400",
            name="target_protein_range",
        ),
    )

    id: Mapped[str] = mapped_column(String(48), primary_key=True, default=lambda: new_id("usr"))
    google_sub: Mapped[str] = mapped_column(String(255), unique=True)
    email: Mapped[str] = mapped_column(String(320))
    display_name: Mapped[str | None] = mapped_column(String(80))
    target_calories: Mapped[int | None] = mapped_column(Integer)
    target_protein_g: Mapped[Decimal | None] = mapped_column(Numeric(6, 1))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Meal(Base):
    __tablename__ = "meals"
    __table_args__ = (
        # Natural idempotency key: a replayed offline write returns the same row (ADR-001).
        UniqueConstraint("user_id", "client_id", name="user_client"),
        CheckConstraint(_in_list("meal_type", MEAL_TYPES), name="meal_type_allowed"),
        CheckConstraint(_in_list("source", MEAL_SOURCES), name="source_allowed"),
        CheckConstraint("calories BETWEEN 0 AND 5000", name="calories_range"),
        CheckConstraint("protein_g BETWEEN 0 AND 300", name="protein_range"),
        CheckConstraint("carbs_g BETWEEN 0 AND 500", name="carbs_range"),
        CheckConstraint("fat_g BETWEEN 0 AND 300", name="fat_range"),
        CheckConstraint("version >= 1", name="version_positive"),
        Index("user_eaten_at", "user_id", "eaten_at"),
    )

    id: Mapped[str] = mapped_column(String(48), primary_key=True, default=lambda: new_id("meal"))
    user_id: Mapped[str] = mapped_column(String(48), ForeignKey("users.id", ondelete="CASCADE"))
    client_id: Mapped[uuid.UUID] = mapped_column(Uuid)
    meal_type: Mapped[str] = mapped_column(String(16))
    eaten_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    name: Mapped[str] = mapped_column(String(120))
    calories: Mapped[Decimal] = mapped_column(Numeric(7, 1))
    protein_g: Mapped[Decimal] = mapped_column(Numeric(6, 1))
    carbs_g: Mapped[Decimal] = mapped_column(Numeric(6, 1))
    fat_g: Mapped[Decimal] = mapped_column(Numeric(6, 1))
    photo_id: Mapped[str | None] = mapped_column(String(48))
    source: Mapped[str] = mapped_column(String(16))
    version: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
