import asyncio

from conftest import ORIGIN, PASSWORD, access_csrf, open_client, register
from sqlalchemy import func, select

from app.auth.models import Session
from app.auth.tokens import REFRESH_COOKIE
from app.database import get_session_factory


async def test_rotation_logout_and_devices(client):
    assert (await client.post("/api/v1/auth/refresh")).status_code == 401
    response = await client.post(
        "/api/v1/auth/register", json={"login": "origin", "password": PASSWORD, "device_id": "d"}
    )
    assert response.status_code == 403
    user = await register(client)
    assert (await client.get("/api/v1/me")).json() == user
    assert (await client.post("/api/v1/auth/logout")).status_code == 403
    old_refresh = client.cookies[REFRESH_COOKIE]
    async with open_client() as second, open_client() as rival:
        login = await second.post(
            "/api/v1/auth/login",
            headers={"Origin": ORIGIN},
            json={"login": user["login"], "password": PASSWORD, "device_id": "device-2"},
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
        assert (await second.get("/api/v1/me")).json() == user


async def test_concurrent_login_reuses_device(client):
    user = await register(client)
    async with open_client() as second, open_client() as third:
        results = await asyncio.gather(
            *[
                browser.post(
                    "/api/v1/auth/login",
                    headers={"Origin": ORIGIN},
                    json={
                        "login": user["login"],
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
