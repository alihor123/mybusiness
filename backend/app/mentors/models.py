from uuid import UUID, uuid4

from sqlalchemy import Boolean, ForeignKey, Integer, String, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Mentor(Base):
    __tablename__ = "mentors"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    user_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL"), unique=True, nullable=True
    )
    stable_key: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200))
    headline: Mapped[str] = mapped_column(String(300))
    about: Mapped[str]
    experience_label: Mapped[str] = mapped_column(String(100))
    experience_anchor_year: Mapped[int] = mapped_column(Integer)
    industry_codes: Mapped[list[str]] = mapped_column(JSONB)
    project_stage_codes: Mapped[list[str]] = mapped_column(JSONB)
    help_topics: Mapped[list[str]] = mapped_column(JSONB)
    meeting_format: Mapped[str] = mapped_column(String(32))
    bio_sources: Mapped[list[str]] = mapped_column(JSONB)
    portrait_url: Mapped[str] = mapped_column(String(500))
    contacts: Mapped[dict] = mapped_column(JSONB, default=dict)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=True)
    accepts_demo_applications: Mapped[bool] = mapped_column(Boolean, default=True)
    showcase_login: Mapped[bool] = mapped_column(Boolean, default=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)
