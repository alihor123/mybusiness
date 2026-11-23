import asyncio
from uuid import uuid4

from conftest import ORIGIN, PASSWORD, access_csrf, open_client, register
from scripts.seed_proda import USER_ID, create_user
from sqlalchemy import func, select

from app.auth.models import Session
from app.auth.service import hash_password
from app.auth.tokens import REFRESH_COOKIE
from app.config import get_settings
from app.database import get_session_factory


async def test_simplified_registration_accepts_short_values(client):
    email = str(uuid4().int)
    response = await client.post(
        "/api/v1/auth/register",
        headers={"Origin": ORIGIN},
        json={"first_name": "123", "last_name": "", "email": email, "password": "x", "device_id": "d"},
    )
    assert response.status_code == 201, response.text
    async with open_client() as second:
        login = await second.post(
            "/api/v1/auth/login",
            headers={"Origin": ORIGIN},
            json={"email": email, "password": "x", "device_id": "device-2"},
        )
    assert login.status_code == 200, login.text


async def test_strict_registration_returns_generic_validation(monkeypatch, client):
    monkeypatch.setenv("SIMPLIFIED_REGISTRATION", "false")
    get_settings.cache_clear()
    response = await client.post(
        "/api/v1/auth/register",
        headers={"Origin": ORIGIN},
        json={"first_name": "Invalid1", "last_name": "User", "email": "bad", "password": "x", "device_id": "d"},
    )
    assert response.status_code == 422
    assert response.json() == {"detail": "Некорректные данные"}

    fields = {
        "first_name": "Анна",
        "last_name": "Соколова",
        "email": f"strict-{uuid4()}@example.com",
        "device_id": "strict-test",
    }
    weak = await client.post(
        "/api/v1/auth/register", headers={"Origin": ORIGIN}, json={**fields, "password": "12345678"}
    )
    assert weak.status_code == 422
    assert weak.json() == response.json()
    valid = await client.post(
        "/api/v1/auth/register", headers={"Origin": ORIGIN}, json={**fields, "password": "Пример-2026"}
    )
    assert valid.status_code == 201, valid.text


async def test_email_is_unique_and_profile_email_is_immutable(client):
    user = await register(client)
    duplicate = await client.post(
        "/api/v1/auth/register",
        headers={"Origin": ORIGIN},
        json={"first_name": "Other", "last_name": "Person", "email": user["email"].upper(), "password": PASSWORD, "device_id": "other"},
    )
    assert duplicate.status_code == 409
    response = await client.patch(
        "/api/v1/me", headers=access_csrf(client), json={"email": "changed@example.com"}
    )
    assert response.status_code == 200
    assert response.json()["email"] == user["email"]


async def test_rotation_logout_and_devices(client):
    assert (await client.post("/api/v1/auth/refresh")).status_code == 401
    response = await client.post(
        "/api/v1/auth/register", json={"first_name": "Test", "last_name": "User", "email": "origin@example.com", "password": PASSWORD, "device_id": "d"}
    )
    assert response.status_code == 403
    user = await register(client)
    profile = (await client.get("/api/v1/me")).json()
    assert profile == {**user, "show_diagnostic_on_login": False}
    assert user["is_demo"] is False
    assert user["show_diagnostic_on_login"] is True
    assert (await client.post("/api/v1/auth/logout")).status_code == 403
    old_refresh = client.cookies[REFRESH_COOKIE]
    async with open_client() as second, open_client() as rival:
        login = await second.post(
            "/api/v1/auth/login",
            headers={"Origin": ORIGIN},
            json={"email": user["email"], "password": PASSWORD, "device_id": "device-2"},
        )
        assert login.status_code == 200, login.text
        rival.cookies.update(client.cookies)
        csrf = {"X-CSRF-TOKEN": client.cookies["csrf_refresh_token"]}
        requests = [
            browser.post("/api/v1/auth/refresh", headers=csrf) for browser in (client, rival)
        ]
        results = await asyncio.gather(*requests)
        assert sorted(response.status_code for response in results) == [204, 401]
        winner = client if results[0].status_code == 204 else rival
        loser_response = results[1] if winner is client else results[0]
        assert "set-cookie" not in loser_response.headers
        assert winner.cookies[REFRESH_COOKIE] != old_refresh
        assert (await client.get("/api/v1/me")).status_code == 200
        assert (await rival.get("/api/v1/me")).status_code == 200
        assert (await winner.get("/api/v1/me")).status_code == 200
        assert (
            await winner.post("/api/v1/auth/logout", headers=access_csrf(winner))
        ).status_code == 204
        assert (await winner.get("/api/v1/me")).status_code == 401
        assert (await second.get("/api/v1/me")).json() == profile


async def test_concurrent_login_reuses_device(client):
    user = await register(client)
    async with open_client() as second, open_client() as third:
        results = await asyncio.gather(
            *[
                browser.post(
                    "/api/v1/auth/login",
                    headers={"Origin": ORIGIN},
                    json={
                        "email": user["email"],
                        "password": PASSWORD,
                        "device_id": "device-1",
                    },
                )
                for browser in (second, third)
            ]
        )
    assert [response.status_code for response in results] == [200, 200]
    async with get_session_factory()() as db:
        from uuid import UUID

        assert (
            await db.scalar(
                select(func.count())
                .select_from(Session)
                .where(
                    Session.user_id == UUID(user["id"]),
                )
            )
            == 1
        )


async def test_test_mode_login_is_scoped_and_disabled_tokens_are_rejected(monkeypatch, client):
    endpoint = "/api/v1/auth/test"
    device = {"device_id": "demo-test"}
    monkeypatch.setenv("TEST_MODE", "false")
    get_settings.cache_clear()
    disabled = await client.post(endpoint, headers={"Origin": ORIGIN}, json=device)
    assert disabled.status_code == 404
    assert disabled.json()["detail"]["code"] == "TEST_MODE_DISABLED"

    monkeypatch.setenv("TEST_MODE", "true")
    get_settings.cache_clear()
    assert (await client.post(endpoint, json=device)).status_code == 403
    password_hash = await hash_password(str(uuid4()))
    async with get_session_factory()() as db, db.begin():
        await create_user(db, password_hash)

    response = await client.post(endpoint, headers={"Origin": ORIGIN}, json=device)
    assert response.status_code == 200, response.text
    profile = response.json()
    assert profile["id"] == str(USER_ID)
    assert profile["is_demo"] is True
    assert profile["show_diagnostic_on_login"] is False
    assert (await client.get("/api/v1/me")).json() == profile

    old_refresh = client.cookies[REFRESH_COOKIE]
    csrf_refresh = client.cookies["csrf_refresh_token"]
    rotated = await client.post(
        "/api/v1/auth/refresh", headers={"X-CSRF-TOKEN": csrf_refresh}
    )
    assert rotated.status_code == 204
    current_refresh = client.cookies[REFRESH_COOKIE]
    current_csrf = client.cookies["csrf_refresh_token"]
    assert current_refresh != old_refresh

    # Logout keeps its ordinary contract while test mode is enabled.
    async with open_client() as logout_client:
        logout_response = await logout_client.post(endpoint, headers={"Origin": ORIGIN}, json={"device_id": "demo-logout"})
        assert logout_response.status_code == 200
        assert (
            await logout_client.post(
                "/api/v1/auth/logout", headers=access_csrf(logout_client)
            )
        ).status_code == 204

    async with open_client() as normal_client:
        await register(normal_client, device_id="ordinary-before-disable")

    monkeypatch.setenv("TEST_MODE", "false")
    get_settings.cache_clear()
    async with open_client() as replay:
        replay.cookies.update(client.cookies)
        denied_access = await replay.get("/api/v1/me")
        assert denied_access.status_code == 401
        assert denied_access.json()["detail"]["code"] == "TEST_MODE_DISABLED"
        cleared = "\n".join(denied_access.headers.get_list("set-cookie"))
        assert "access_token_cookie" in cleared and "Max-Age=0" in cleared
        assert "refresh_token_cookie" in cleared and "Max-Age=0" in cleared
        assert "csrf_access_token" in cleared and "Max-Age=0" in cleared
        assert "csrf_refresh_token" in cleared and "Max-Age=0" in cleared

    # Present the last usable refresh independently from the cleared access cookies.
    async with open_client() as replay:
        replay.cookies[REFRESH_COOKIE] = current_refresh
        denied_refresh = await replay.post(
            "/api/v1/auth/refresh",
            headers={"X-CSRF-TOKEN": current_csrf},
        )
        assert denied_refresh.status_code == 401
        assert denied_refresh.json()["detail"]["code"] == "TEST_MODE_DISABLED"

    async with open_client() as normal_replay:
        normal_replay.cookies.update(normal_client.cookies)
        normal_response = await normal_replay.get("/api/v1/me")
        assert normal_response.status_code == 200
        assert normal_response.json()["is_demo"] is False
