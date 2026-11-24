from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, Field

from app.audience import Audience
from app.learning.assessment import Answer, Options

StepType = Literal["theory", "video", "choice", "matching", "written", "final"]


class TextBlock(BaseModel):
    type: Literal["text"]
    title: str | None = None
    text: str
    is_video_summary: bool = False


class ImageBlock(BaseModel):
    type: Literal["image"]
    url: str
    alt: str
    caption: str | None = None


class DiagramItem(BaseModel):
    title: str
    text: str
    icon: str


class DiagramBlock(BaseModel):
    type: Literal["diagram"]
    items: list[DiagramItem]


class ExampleItem(BaseModel):
    title: str
    text: str
    variant: str


class ExamplesBlock(BaseModel):
    type: Literal["examples"]
    items: list[ExampleItem]


class VideoBlock(BaseModel):
    type: Literal["video"]
    url: str
    poster_url: str | None = None


class AttachmentBlock(BaseModel):
    type: Literal["attachment"]
    url: str
    title: str


Block = Annotated[
    TextBlock | ImageBlock | DiagramBlock | ExamplesBlock | VideoBlock | AttachmentBlock,
    Field(discriminator="type"),
]


class StepSummary(BaseModel):
    id: str
    position: int
    title: str
    type: StepType
    optional_by_diagnostic: bool
    credited: bool
    credit_source: Literal["earned", "diagnostic"] | None
    can_credit: bool


class TrackProgress(BaseModel):
    track_id: str
    required_count: int
    credited_required_count: int
    credited_count: int
    status: Literal["not_started", "in_progress", "completed"]
    next_required_step_id: str | None
    current_step_id: str


class Progress(BaseModel):
    audience: Audience
    tracks: list[TrackProgress]
    can_create_project: bool
    route_completed: bool
    first_project_id: UUID | None
    draft_project_id: UUID | None = None


class TrackOut(TrackProgress):
    id: str
    title: str
    description: str
    cover_url: str
    position: int


class TrackDetail(TrackOut):
    steps: list[StepSummary]


class AttemptOut(BaseModel):
    id: UUID
    number: int
    request_key: str
    answer: Answer
    status: Literal["checking", "check_unavailable", "accepted", "rejected"]
    accepted: bool | None
    remarks: list[str]
    prefill_status: Literal["checking", "succeeded", "failed"] | None


class StepOut(StepSummary):
    track_id: str
    blocks: list[Block]
    prompt: str | None
    options: Options | None
    draft: Answer | None
    last_attempt: AttemptOut | None


class TrackStepsOut(BaseModel):
    track: TrackDetail
    lessons: list[StepOut]


class DraftIn(BaseModel):
    answer: Answer | None = None
    saved_at_ms: int | None = Field(None, ge=0)


class CompletionIn(BaseModel):
    event: Literal["text_end", "video_end"]


class SubmissionIn(BaseModel):
    answer: Answer
    request_key: str = Field(min_length=1, max_length=128, pattern=r"^[A-Za-z0-9_.:-]+$")
    saved_at_ms: int | None = Field(None, ge=0)


class SubmissionOut(BaseModel):
    attempt: AttemptOut
    progress: Progress


class HelpIn(BaseModel):
    question: str = Field(min_length=1, max_length=2000, pattern=r"\S")
    current_input: str | None = Field(None, max_length=10_000)


class Hint(BaseModel):
    hint: str = Field(min_length=1, max_length=4000)
