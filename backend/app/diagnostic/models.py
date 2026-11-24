from datetime import datetime
from uuid import UUID

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Question(Base):
    __tablename__ = "diagnostic_questions"
    __table_args__ = (UniqueConstraint("version", "position"),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    version: Mapped[int]
    track_id: Mapped[str] = mapped_column(ForeignKey("tracks.id"))
    position: Mapped[int]
    type: Mapped[str] = mapped_column(String(16))
    prompt: Mapped[str]
    options: Mapped[dict | None] = mapped_column(JSONB(none_as_null=True))
    answer_key: Mapped[str | dict | None] = mapped_column(JSONB(none_as_null=True))
    criteria: Mapped[list[str] | None] = mapped_column(JSONB(none_as_null=True))


class Diagnostic(Base):
    __tablename__ = "diagnostics"
    __table_args__ = (
        CheckConstraint(
            "status IN ('in_progress','skipped','checking','completed')",
            name="ck_diagnostic_status",
        ),
    )

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    version: Mapped[int] = mapped_column(primary_key=True)
    status: Mapped[str] = mapped_column(String(16))
    current_question_id: Mapped[str | None] = mapped_column(ForeignKey("diagnostic_questions.id"))
    answers: Mapped[dict] = mapped_column(JSONB)
    scores: Mapped[dict | None] = mapped_column(JSONB(none_as_null=True))
    check_id: Mapped[UUID | None]
    check_deadline: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    check_unavailable: Mapped[bool] = mapped_column(default=False)
    saved_at_ms: Mapped[int | None] = mapped_column(BigInteger)
