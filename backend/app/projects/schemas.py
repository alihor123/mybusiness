from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

from app.audience import Audience

Short = Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)]
Long = Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)]


class Questionnaire(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: Short | None = None
    industry: Short | None = None
    stage: Short | None = None
    project_audience: Audience | None = None
    audience: Long | None = None
    problem: Long | None = None
    solution_benefit: Long | None = None
    mentor_request: Long | None = None
    saved_at_ms: int | None = Field(None, ge=0, exclude=True)

    @field_validator("project_audience")
    @classmethod
    def require_project_audience_when_set(cls, value: Audience | None) -> Audience | None:
        if value is None:
            raise ValueError("Выберите аудиторию проекта.")
        return value


class ProjectOut(Questionnaire):
    id: UUID
    user_id: UUID
    mentor_id: UUID | None
    project_audience: Audience
    questionnaire_version: int
    archived_at: datetime | None
    status: Literal["draft", "waiting_mentor", "accompaniment", "archived"]


class Recommendation(BaseModel):
    mentor_id: UUID
    reason: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1000)]


class Recommendations(BaseModel):
    recommendations: list[Recommendation]
