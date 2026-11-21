from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AccompanimentPlan(Base):
    __tablename__ = "accompaniment_plans"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    project_id: Mapped[UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), unique=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class AccompanimentTask(Base):
    __tablename__ = "accompaniment_tasks"
    __table_args__ = (
        UniqueConstraint("plan_id", "position"),
        CheckConstraint(
            "status IN ('todo','submitted','revision_requested','accepted')",
            name="ck_accompaniment_task_status",
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    plan_id: Mapped[UUID] = mapped_column(
        ForeignKey("accompaniment_plans.id", ondelete="CASCADE"), index=True
    )
    position: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String(200))
    condition: Mapped[str] = mapped_column(Text)
    criteria: Mapped[list[str]] = mapped_column(JSONB)
    status: Mapped[str] = mapped_column(String(24), default="todo")
    current_submission_id: Mapped[UUID | None] = mapped_column(
        ForeignKey(
            "accompaniment_submissions.id", use_alter=True, name="fk_task_current_submission"
        )
    )


class AccompanimentAttachment(Base):
    __tablename__ = "accompaniment_attachments"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    filename: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str] = mapped_column(String(64))
    size: Mapped[int] = mapped_column(Integer)
    storage_key: Mapped[str] = mapped_column(String(64), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class TaskDraft(Base):
    __tablename__ = "accompaniment_task_drafts"

    task_id: Mapped[UUID] = mapped_column(
        ForeignKey("accompaniment_tasks.id", ondelete="CASCADE"), primary_key=True
    )
    text: Mapped[str] = mapped_column(Text, default="")
    attachment_id: Mapped[UUID | None] = mapped_column(ForeignKey("accompaniment_attachments.id"))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class TaskSubmission(Base):
    __tablename__ = "accompaniment_submissions"
    __table_args__ = (
        UniqueConstraint("task_id", "number"),
        UniqueConstraint("task_id", "request_key"),
        CheckConstraint(
            "status IN ('submitted','revision_requested','accepted')",
            name="ck_accompaniment_submission_status",
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    task_id: Mapped[UUID] = mapped_column(
        ForeignKey("accompaniment_tasks.id", ondelete="CASCADE"), index=True
    )
    number: Mapped[int] = mapped_column(Integer)
    request_key: Mapped[str] = mapped_column(String(128))
    text: Mapped[str] = mapped_column(Text)
    attachment_id: Mapped[UUID | None] = mapped_column(ForeignKey("accompaniment_attachments.id"))
    status: Mapped[str] = mapped_column(String(24), default="submitted")
    decision_comment: Mapped[str | None] = mapped_column(Text)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class ProjectMeeting(Base):
    __tablename__ = "accompaniment_meetings"

    project_id: Mapped[UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True
    )
    title: Mapped[str] = mapped_column(String(200))
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    url: Mapped[str] = mapped_column(String(2000))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
