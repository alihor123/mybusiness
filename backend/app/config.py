from functools import lru_cache
from uuid import UUID

from pydantic import Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    jwt_secret: SecretStr = Field(min_length=32)
    access_ttl_seconds: int = Field(900, gt=0)
    refresh_ttl_seconds: int = Field(2_592_000, gt=0)
    cookie_secure: bool = True
    cookie_domain: str = ""
    public_origin: str = "https://localhost"
    private_upload_dir: str = "var/uploads"
    test_user: bool = False
    test_user_id: UUID = UUID("00000000-0000-4000-8000-000000000001")
    demo_password: SecretStr = SecretStr("")
    local_demo_mode: bool = False
    simplified_registration: bool = True

    deepseek_api_key: SecretStr = SecretStr("")
    deepseek_base_url: str = "https://api.deepseek.com"
    deepseek_model: str = "deepseek-flash"
    deepseek_timeout_seconds: float = Field(20, gt=0, le=60)
    deepseek_max_retries: int = Field(1, ge=0, le=3)
    deepseek_max_output_tokens: int = Field(1200, gt=0)
    deepseek_thinking: bool = False

    @model_validator(mode="after")
    def validate_session_lifetimes(self) -> "Settings":
        if self.access_ttl_seconds >= self.refresh_ttl_seconds:
            raise ValueError("Access TTL must be shorter than refresh TTL")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
