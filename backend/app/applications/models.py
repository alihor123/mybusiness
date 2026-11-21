from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Application(Base):
    __tablename__ = "mentor_applications"
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending','accepted','rejected','withdrawn','closed_selected_other')",
            name="ck_mentor_application_status",
        ),
        Index(
            "uq_pending_mentor_application",
            "project_id",
            "mentor_id",
            unique=True,
            postgresql_where=text("status = 'pending'"),
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    project_id: Mapped[UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    mentor_id: Mapped[UUID] = mapped_column(ForeignKey("mentors.id"), index=True)
    status: Mapped[str] = mapped_column(String(32))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reason: Mapped[str | None]
