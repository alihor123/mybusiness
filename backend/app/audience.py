from enum import Enum

from sqlalchemy import String


class Audience(str, Enum):
    STUDENT = "student"
    SELF_EMPLOYED = "self_employed"
    STARTUP = "startup"


AUDIENCE_TYPE = String(32)
AUDIENCE_VALUES = "('student', 'self_employed', 'startup')"
DEFAULT_AUDIENCE = Audience.STUDENT
