from datetime import datetime
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import DateTime, ForeignKey, select
from sqlalchemy.dialects.postgresql import JSONB, insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column

from app.auth.tokens import utcnow
from app.database import Base


class ProjectPrefill(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(None, max_length=200)
    industry: str | None = Field(None, max_length=200)
    stage: str | None = Field(None, max_length=200)
    audience: str | None = Field(None, max_length=2000)
    problem: str | None = Field(None, max_length=2000)
    solution: str | None = Field(None, max_length=2000)
    completed_actions: str | None = Field(None, max_length=2000)
    solution_benefit: str | None = Field(None, max_length=2000)
    mentor_request: str | None = Field(None, max_length=2000)

    @field_validator("*")
    @classmethod
    def normalize_field(cls, value: str | None) -> str | None:
        return (value.strip() or None) if value is not None else None


class FirstProjectDraft(Base):
    __tablename__ = "first_project_drafts"

    completion_id: Mapped[UUID] = mapped_column(primary_key=True)
    project_id: Mapped[UUID] = mapped_column(unique=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    prefill: Mapped[dict] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


async def ensure_first_project(
    db: AsyncSession, *, user_id: UUID, completion_id: UUID, project_prefill: ProjectPrefill
) -> UUID:
    """Reserve the first draft in the caller's transaction and keep its identity."""
    project_id = await db.scalar(
        insert(FirstProjectDraft)
        .values(
            completion_id=completion_id,
            user_id=user_id,
            prefill=project_prefill.model_dump(exclude_none=True),
            created_at=utcnow(),
        )
        .on_conflict_do_nothing(index_elements=[FirstProjectDraft.completion_id])
        .returning(FirstProjectDraft.project_id)
    )
    if project_id is not None:
        return project_id
    return (
        await db.scalars(
            select(FirstProjectDraft.project_id).where(
                FirstProjectDraft.completion_id == completion_id,
                FirstProjectDraft.user_id == user_id,
            )
        )
    ).one()
