import os
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient

from app.ai.client import get_deepseek
from app.auth.tokens import get_auth
from app.config import get_settings
from app.database import get_session_factory
from app.main import app

ORIGIN = "https://mybusiness.test"
PASSWORD = "integration-test-password"


@pytest.fixture(autouse=True)
async def database(monkeypatch):
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.skip("Set TEST_DATABASE_URL to a migrated disposable PostgreSQL database")
    monkeypatch.setenv("DATABASE_URL", url)
    monkeypatch.setenv("JWT_SECRET", "test-only-very-long-jwt-signing-secret")
    monkeypatch.setenv("PUBLIC_ORIGIN", ORIGIN)
    monkeypatch.setenv("COOKIE_SECURE", "true")
    monkeypatch.setenv("SIMPLIFIED_REGISTRATION", "true")
    yield
    if get_session_factory.cache_info().currsize:
        await get_session_factory().kw["bind"].dispose()
    get_session_factory.cache_clear()
    get_settings.cache_clear()
    get_auth.cache_clear()
    get_deepseek.cache_clear()
    app.dependency_overrides.clear()


def open_client():
    return AsyncClient(transport=ASGITransport(app=app), base_url=ORIGIN)


@pytest.fixture
async def client():
    async with open_client() as instance:
        yield instance


async def register(client, *, device_id="device-1", audience="student"):
    email = f"pytest-{uuid4()}@example.com"
    response = await client.post(
        "/api/v1/auth/register",
        headers={"Origin": ORIGIN},
        json={
            "first_name": "Test",
            "last_name": "Student",
            "email": email,
            "password": PASSWORD,
            "device_id": device_id,
            "audience": audience,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def access_csrf(client):
    return {"X-CSRF-TOKEN": client.cookies["csrf_access_token"]}
