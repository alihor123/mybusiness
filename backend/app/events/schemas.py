from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class EventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    stable_key: str
    title: str
    description: str
    starts_at: datetime
    url: str
    location: str
