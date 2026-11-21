from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import Boolean, DateTime, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Event(Base):
    __tablename__ = "events"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    stable_key: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(300))
    description: Mapped[str]
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    url: Mapped[str] = mapped_column(String(1000))
    location: Mapped[str] = mapped_column(String(300))
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)
