from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.projects.schemas import ProjectOut


class ApplicationIn(BaseModel):
    mentor_id: UUID


class DecisionIn(BaseModel):
    decision: Literal["accept", "reject"]
    questionnaire_version: int = Field(ge=1)


class ApplicationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    mentor_id: UUID
    status: Literal["pending", "accepted", "rejected", "withdrawn", "closed_selected_other"]
    created_at: datetime
    decided_at: datetime | None
    reason: str | None


class ApplicationDetail(ApplicationOut):
    project: ProjectOut
