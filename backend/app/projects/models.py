from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.audience import AUDIENCE_TYPE, AUDIENCE_VALUES, Audience
from app.database import Base


class Project(Base):
    __tablename__ = "projects"
    __table_args__ = (
        CheckConstraint(f"project_audience IN {AUDIENCE_VALUES}", name="ck_projects_project_audience"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), index=True)
    mentor_id: Mapped[UUID | None] = mapped_column(ForeignKey("mentors.id"), index=True)
    title: Mapped[str | None]
    industry: Mapped[str | None]
    stage: Mapped[str | None]
    project_audience: Mapped[Audience] = mapped_column(
        AUDIENCE_TYPE, default=Audience.STUDENT, server_default=Audience.STUDENT.value
    )
    audience: Mapped[str | None]
    problem: Mapped[str | None]
    solution_benefit: Mapped[str | None]
    mentor_request: Mapped[str | None]
    questionnaire_version: Mapped[int] = mapped_column(default=1, server_default="1")
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    saved_at_ms: Mapped[int | None] = mapped_column(BigInteger)
