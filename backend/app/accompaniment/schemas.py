from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, Field, HttpUrl, StringConstraints


class AttachmentOut(BaseModel):
    id: UUID
    filename: str
    content_type: str
    size: int


class SubmissionOut(BaseModel):
    id: UUID
    number: int
    request_key: str
    text: str
    status: Literal["submitted", "revision_requested", "accepted"]
    decision_comment: str | None
    created_at: datetime
    attachment: AttachmentOut | None


class TaskOut(BaseModel):
    id: UUID
    position: int
    title: str
    condition: str
    criteria: list[str]
    status: Literal["todo", "submitted", "revision_requested", "accepted"]
    allowed_actions: list[
        Literal["save_draft", "preview_check", "submit", "accept", "request_revision"]
    ]
    draft_text: str | None = None
    draft_attachment: AttachmentOut | None = None
    submissions: list[SubmissionOut] = Field(default_factory=list)


class AssignedMentor(BaseModel):
    id: UUID
    name: str
    contacts: dict[str, str]


class PlanOut(BaseModel):
    mentor: AssignedMentor | None = None
    project_id: UUID
    tasks: list[TaskOut]
    next_task_id: UUID | None
    accepted_count: int
    plan_completed: bool


class PreviewIn(BaseModel):
    text: str = Field(min_length=1, max_length=10_000)


class PreviewOut(BaseModel):
    remarks: list[str]


class DecisionIn(BaseModel):
    decision: Literal["accept", "revision_requested"]
    comment: str | None = Field(None, max_length=4000)


class DecisionOut(BaseModel):
    submission: SubmissionOut
    task_status: Literal["revision_requested", "accepted"]
    accepted_count: int
    plan_completed: bool


class MeetingIn(BaseModel):
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
    starts_at: AwareDatetime
    url: HttpUrl


class MeetingOut(BaseModel):
    project_id: UUID
    title: str
    starts_at: datetime
    url: str
