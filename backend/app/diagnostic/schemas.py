from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.audience import Audience
from app.learning.assessment import Answer, Options


class QuestionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    track_id: str
    position: int
    type: Literal["choice", "matching", "free"]
    prompt: str
    options: Options | None


class Draft(BaseModel):
    answers: dict[str, Answer] = Field(max_length=9)
    current_question_id: str
    saved_at_ms: int | None = Field(None, ge=0)


class Submit(BaseModel):
    answers: dict[str, Answer] = Field(min_length=9, max_length=9)
    saved_at_ms: int | None = Field(None, ge=0)


class TrackScore(BaseModel):
    track_id: str
    score: int
    max_score: Literal[3] = 3
    optional_exercises: int


class DiagnosticOut(BaseModel):
    audience: Audience
    status: Literal["not_started", "in_progress", "skipped", "checking", "completed"]
    version: int
    questions: list[QuestionOut]
    current_question_id: str | None
    answers: dict[str, Answer]
    results: list[TrackScore] | None = None
    check_unavailable: bool = False


class FreeScores(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    scores: dict[str, bool]
