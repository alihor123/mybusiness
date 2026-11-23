from uuid import UUID

from pydantic import BaseModel, ConfigDict


class MentorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    stable_key: str
    name: str
    headline: str
    about: str
    experience_label: str
    experience_anchor_year: int
    industry_codes: list[str]
    project_stage_codes: list[str]
    help_topics: list[str]
    meeting_format: str
    bio_sources: list[str]
    portrait_url: str
    is_demo: bool
    accepts_demo_applications: bool
    active: bool


class MentorPage(BaseModel):
    items: list[MentorOut]
    next_offset: int | None
