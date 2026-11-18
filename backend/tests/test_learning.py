import asyncio
import json
from pathlib import Path
from uuid import UUID

from conftest import access_csrf, open_client, register
from sqlalchemy import func, select

from app.ai.client import CheckUnavailable, get_deepseek
from app.database import get_session_factory
from app.diagnostic.schemas import FreeScores
from app.learning.assessment import CheckDecision
from app.learning.schemas import Hint
from app.main import app
from app.projects.bootstrap import FirstProjectDraft, ProjectPrefill

SEED = Path(__file__).resolve().parents[1] / "migrations" / "seed_data"
TRACKS = json.loads((SEED / "tracks.json").read_text(encoding="utf-8"))["tracks"]
QUESTIONS = json.loads((SEED / "diagnostic.json").read_text(encoding="utf-8"))["questions"]
BASE = "/api/v1"


class FakeAI:
    def __init__(self, *, fail_first=False, fail_prefill=False):
        self.fail_first = fail_first
        self.fail_prefill = fail_prefill
        self.calls = []

    async def complete(self, instructions, data, result_type):
        data = json.loads(data)
        self.calls.append(result_type)
        if self.fail_first:
            self.fail_first = False
            raise CheckUnavailable("temporary")
        if result_type is FreeScores:
            return FreeScores(scores={item["id"]: True for item in data})
        if result_type is CheckDecision:
            return CheckDecision(accepted=True, remarks=[])
        if result_type is Hint:
            return Hint(hint="Проверьте, в какой момент возникает очередь.")
        assert result_type is ProjectPrefill
        if self.fail_prefill:
            raise CheckUnavailable("prefill failed")
        return ProjectPrefill(title="Кофе между парами")


async def send(client, method, path, **kwargs):
    return await client.request(method, f"{BASE}{path}", headers=access_csrf(client), **kwargs)


async def do_step(client, step):
    path = f"/learning/steps/{step['id']}"
    if step["type"] in {"video", "theory"}:
        event = "video_end" if step["type"] == "video" else "text_end"
        return await send(client, "POST", path + "/complete", json={"event": event})
    return await send(
        client,
        "POST",
        path + "/submissions",
        json={
            "answer": step.get("answer_key") or "Студенты теряют время в очереди за кофе.",
            "request_key": step["id"],
        },
    )


async def test_skip_get_back_to_diagnostic_and_shorter_route(client):
    await register(client)
    ai = FakeAI(fail_first=True)
    app.dependency_overrides[get_deepseek] = lambda: ai
    initial = await client.get(f"{BASE}/diagnostic")
    assert initial.json()["status"] == "not_started"
    assert len(initial.json()["questions"]) == 9
    assert "answer_key" not in initial.text and "criteria" not in initial.text
    answers = {
        q["id"]: q.get("answer_key") or "Предложение проверено у клиентов." for q in QUESTIONS
    }
    draft = {
        "answers": {QUESTIONS[0]["id"]: answers[QUESTIONS[0]["id"]]},
        "current_question_id": QUESTIONS[1]["id"],
    }
    assert (await send(client, "PUT", "/diagnostic/draft", json=draft)).status_code == 200
    skipped = await send(client, "POST", "/diagnostic/skip")
    assert skipped.json()["answers"] == draft["answers"]
    assert skipped.json()["current_question_id"] == draft["current_question_id"]
    steps = TRACKS[0]["steps"]
    assert (await do_step(client, steps[1])).status_code == 409
    for step in steps[:3]:
        response = await do_step(client, step)
        assert response.status_code == 200, response.text

    failed = await send(client, "POST", "/diagnostic/submit", json={"answers": answers})
    assert failed.status_code == 503
    assert failed.json()["detail"]["code"] == "CHECK_UNAVAILABLE"
    saved = (await client.get(f"{BASE}/diagnostic")).json()
    assert saved["answers"] == answers and saved["check_unavailable"]
    completed = await send(client, "POST", "/diagnostic/submit", json={"answers": answers})
    assert completed.status_code == 200, completed.text
    assert {result["score"] for result in completed.json()["results"]} == {3}
    await send(client, "POST", "/diagnostic/submit", json={"answers": answers})
    assert ai.calls == [FreeScores, FreeScores]
    track = (await client.get(f"{BASE}/tracks/idea-validation")).json()
    assert track["required_count"] == 8 and track["credited_count"] == 3
    assert track["credited_required_count"] == 2
    assert track["steps"][2]["optional_by_diagnostic"] and track["steps"][2]["credited"]
    assert track["steps"][4]["optional_by_diagnostic"] and not track["steps"][4]["credited"]
    assert not track["steps"][9]["optional_by_diagnostic"]
    assert (await client.get(f"{BASE}/learning/steps/idea-validation-10")).status_code == 200


async def test_full_route_retry_and_one_first_draft(client):
    user = await register(client)
    ai = FakeAI(fail_prefill=True)
    app.dependency_overrides[get_deepseek] = lambda: ai
    assert (await send(client, "POST", "/diagnostic/skip")).status_code == 200
    for track in TRACKS:
        for step in track["steps"]:
            if step["id"] == TRACKS[-1]["steps"][-1]["id"]:
                break
            if step["id"] == "idea-validation-06":
                path = f"/learning/steps/{step['id']}"
                draft = await send(client, "PUT", path + "/draft", json={"answer": "Черновик"})
                assert draft.json()["draft"] == "Черновик"
                hint = await send(
                    client, "POST", path + "/help", json={"question": "Что проверить?"}
                )
                assert hint.status_code == 200
                assert (await client.get(f"{BASE}{path}")).json()["credited"] is False
                ai.fail_first = True
                failed = await do_step(client, step)
                assert failed.status_code == 503
                saved = (await client.get(f"{BASE}{path}")).json()["last_attempt"]
                assert saved["status"] == "check_unavailable" and saved["number"] == 1
            response = await do_step(client, step)
            assert response.status_code == 200, (step["id"], response.text)
            if step["id"] == "idea-validation-06":
                assert response.json()["attempt"]["id"] == saved["id"]

    before = (await client.get(f"{BASE}/learning/progress")).json()
    assert not before["can_create_project"] and before["first_project_id"] is None
    final = TRACKS[-1]["steps"][-1]
    async with open_client() as duplicate:
        duplicate.cookies.update(client.cookies)
        results = await asyncio.gather(do_step(client, final), do_step(duplicate, final))
    assert sorted(result.status_code for result in results) in ([200, 200], [200, 409])
    expected = next(result.json() for result in results if result.status_code == 200)
    assert expected["attempt"]["prefill_status"] == "failed"
    assert expected["progress"]["can_create_project"]
    project_id = expected["progress"]["first_project_id"]
    assert project_id
    replay = await do_step(client, final)
    assert replay.json()["progress"]["first_project_id"] == project_id
    async with get_session_factory()() as db:
        assert (
            await db.scalar(
                select(func.count())
                .select_from(FirstProjectDraft)
                .where(
                    FirstProjectDraft.user_id == UUID(user["id"]),
                )
            )
            == 1
        )


async def test_short_route_skips_both_exercises_and_keeps_final_required(client):
    await register(client)
    ai = FakeAI()
    app.dependency_overrides[get_deepseek] = lambda: ai
    answers = {
        q["id"]: q.get("answer_key") or "Клиенты подтвердили потребность." for q in QUESTIONS
    }
    assert (
        await send(client, "POST", "/diagnostic/submit", json={"answers": answers})
    ).status_code == 200
    for track in TRACKS:
        for step in track["steps"]:
            if step.get("optional_rank"):
                continue
            response = await do_step(client, step)
            assert response.status_code == 200, response.text
    completed = (await client.get(f"{BASE}/learning/progress")).json()
    assert completed["can_create_project"]
    assert all(track["credited_required_count"] == 8 for track in completed["tracks"])
    async with get_session_factory()() as db:
        assert (
            await db.scalar(
                select(FirstProjectDraft).where(
                    FirstProjectDraft.project_id == UUID(completed["first_project_id"]),
                )
            )
        ).prefill == {"title": "Кофе между парами"}
