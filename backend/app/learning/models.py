from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Track(Base):
    __tablename__ = "tracks"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    position: Mapped[int] = mapped_column(unique=True)
    title: Mapped[str]
    description: Mapped[str]
    cover_url: Mapped[str]


class Step(Base):
    __tablename__ = "learning_steps"
    __table_args__ = (
        UniqueConstraint("track_id", "position"),
        UniqueConstraint("track_id", "optional_rank"),
        CheckConstraint(
            "optional_rank IS NULL OR (optional_rank IN (1,2) "
            "AND type IN ('choice','matching','written'))",
            name="ck_step_optional_exercise",
        ),
        CheckConstraint("(position = 10) = (type = 'final')", name="ck_step_final_position"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    track_id: Mapped[str] = mapped_column(ForeignKey("tracks.id"), index=True)
    position: Mapped[int]
    title: Mapped[str]
    type: Mapped[str] = mapped_column(String(16))
    blocks: Mapped[list[dict]] = mapped_column(JSONB)
    prompt: Mapped[str | None]
    options: Mapped[dict | None] = mapped_column(JSONB(none_as_null=True))
    answer_key: Mapped[str | dict | None] = mapped_column(JSONB(none_as_null=True))
    criteria: Mapped[list[str] | None] = mapped_column(JSONB(none_as_null=True))
    optional_rank: Mapped[int | None]


class TrackPosition(Base):
    __tablename__ = "learning_positions"

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    track_id: Mapped[str] = mapped_column(ForeignKey("tracks.id"), primary_key=True)
    step_id: Mapped[str] = mapped_column(ForeignKey("learning_steps.id"))


class Draft(Base):
    __tablename__ = "learning_drafts"

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    step_id: Mapped[str] = mapped_column(ForeignKey("learning_steps.id"), primary_key=True)
    answer: Mapped[str | dict] = mapped_column(JSONB)


class Attempt(Base):
    __tablename__ = "learning_attempts"
    __table_args__ = (
        UniqueConstraint("user_id", "step_id", "request_key"),
        UniqueConstraint("user_id", "step_id", "number"),
        CheckConstraint(
            "status IN ('checking','check_unavailable','accepted','rejected')",
            name="ck_learning_attempt_status",
        ),
        CheckConstraint(
            "prefill_status IS NULL OR prefill_status IN ('checking','succeeded','failed')",
            name="ck_learning_prefill_status",
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    step_id: Mapped[str] = mapped_column(ForeignKey("learning_steps.id"))
    number: Mapped[int]
    request_key: Mapped[str] = mapped_column(String(128))
    answer: Mapped[str | dict] = mapped_column(JSONB)
    status: Mapped[str] = mapped_column(String(20))
    remarks: Mapped[list[str]] = mapped_column(JSONB, default=list)
    check_id: Mapped[UUID | None]
    check_deadline: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    prefill_status: Mapped[str | None] = mapped_column(String(16))
    project_prefill: Mapped[dict | None] = mapped_column(JSONB(none_as_null=True))


class Credit(Base):
    __tablename__ = "learning_credits"

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    step_id: Mapped[str] = mapped_column(ForeignKey("learning_steps.id"), primary_key=True)
    attempt_id: Mapped[UUID | None] = mapped_column(ForeignKey("learning_attempts.id"))
    credited_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class Completion(Base):
    __tablename__ = "learning_completions"

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    id: Mapped[UUID] = mapped_column(unique=True, default=uuid4)
    first_project_id: Mapped[UUID]
    project_prefill: Mapped[dict] = mapped_column(JSONB)
    completed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
