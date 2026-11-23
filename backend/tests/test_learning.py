import asyncio
import json
from pathlib import Path
from time import time_ns
from uuid import UUID

from conftest import access_csrf, open_client, register
from sqlalchemy import func, select

from app.ai.client import CheckUnavailable, get_deepseek
from app.database import get_session_factory
from app.diagnostic.schemas import FreeScores
from app.diagnostic.worker import process_pending_once
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


async def test_track_batch_contains_step_data_and_updates_credits(client):
    await register(client)
    track = TRACKS[0]
    path = f"{BASE}/tracks/{track['id']}/steps"
    response = await client.get(path)
    assert response.status_code == 200
    bundle = response.json()
    assert [step["id"] for step in bundle["lessons"]] == [step["id"] for step in track["steps"]]
    assert bundle["lessons"][0]["blocks"] and bundle["lessons"][0]["can_credit"]
    assert not bundle["lessons"][1]["can_credit"]
    assert "answer_key" not in response.text

    completed = await do_step(client, track["steps"][0])
    assert completed.status_code == 200
    updated = (await client.get(path)).json()
    assert updated["lessons"][0]["credit_source"] == "earned"
    assert updated["lessons"][1]["can_credit"]


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

    pending = await send(client, "POST", "/diagnostic/submit", json={"answers": answers})
    assert pending.status_code == 202 and pending.json()["status"] == "checking"
    await process_pending_once(ai_client=ai)
    saved = (await client.get(f"{BASE}/diagnostic")).json()
    assert saved["answers"] == answers and saved["status"] == "in_progress" and saved["check_unavailable"]
    completed = await send(client, "POST", "/diagnostic/submit", json={"answers": answers})
    assert completed.status_code == 202 and completed.json()["status"] == "checking", completed.text
    await process_pending_once(ai_client=ai)
    completed = await client.get(f"{BASE}/diagnostic")
    assert completed.status_code == 200
    assert {result["score"] for result in completed.json()["results"]} == {3}
    await send(client, "POST", "/diagnostic/submit", json={"answers": answers})
    await process_pending_once(ai_client=ai)
    assert ai.calls == [FreeScores, FreeScores]
    track = (await client.get(f"{BASE}/tracks/idea-validation")).json()
    assert track["required_count"] == 8 and track["credited_count"] == 4
    assert track["credited_required_count"] == 2
    assert track["steps"][2]["optional_by_diagnostic"] and track["steps"][2]["credited"]
    assert track["steps"][2]["credit_source"] == "earned"
    assert track["steps"][4]["optional_by_diagnostic"] and track["steps"][4]["credited"]
    assert track["steps"][4]["credit_source"] == "diagnostic"
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

                response = await send(
                    client,
                    "POST",
                    path + "/submissions",
                    json={"answer": saved["answer"], "request_key": saved["request_key"]},
                )
                assert response.status_code == 200, response.text
                assert response.json()["attempt"]["id"] == saved["id"]
            else:
                response = await do_step(client, step)
                assert response.status_code == 200, (step["id"], response.text)

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
    submitted = await send(client, "POST", "/diagnostic/submit", json={"answers": answers})
    assert submitted.status_code == 202 and submitted.json()["status"] == "checking"
    await process_pending_once(ai_client=ai)
    assert (await client.get(f"{BASE}/diagnostic")).json()["status"] == "completed"
    for track in TRACKS:
        for step in track["steps"]:
            if step.get("optional_rank"):
                continue
            response = await do_step(client, step)
            assert response.status_code == 200, response.text
    completed = (await client.get(f"{BASE}/learning/progress")).json()
    assert completed["can_create_project"]
    assert all(track["credited_required_count"] == 8 for track in completed["tracks"])
    retaken_step = TRACKS[0]["steps"][2]
    wrong = next(option["id"] for option in retaken_step["options"]["choices"] if option["id"] != retaken_step["answer_key"])
    retaken = await send(
        client, "POST", f"/learning/steps/{retaken_step['id']}/submissions",
        json={"answer": wrong, "request_key": "retake-after-learning"},
    )
    assert retaken.status_code == 200 and retaken.json()["attempt"]["accepted"] is False
    retake_progress = retaken.json()["progress"]
    assert retake_progress["can_create_project"] and retake_progress["first_project_id"] == completed["first_project_id"]
    assert all(track["status"] == "completed" for track in retake_progress["tracks"])
    assert (await client.get(f"{BASE}/projects")).status_code == 200
    async with get_session_factory()() as db:
        assert (
            await db.scalar(
                select(FirstProjectDraft).where(
                    FirstProjectDraft.project_id == UUID(completed["first_project_id"]),
                )
            )
        ).prefill == {"title": "Кофе между парами"}


async def test_retake_keeps_prior_result_and_diagnostic_credits(client):
    await register(client)
    ai = FakeAI()
    answers = {
        question["id"]: question.get("answer_key") or "Клиенты подтвердили потребность."
        for question in QUESTIONS
    }
    pending = await send(client, "POST", "/diagnostic/submit", json={"answers": answers})
    assert pending.json()["status"] == "checking"
    await process_pending_once(ai_client=ai)
    first = (await client.get(f"{BASE}/diagnostic")).json()
    assert first["status"] == "completed"
    first_score = next(row["score"] for row in first["results"] if row["track_id"] == "idea-validation")
    first_track = (await client.get(f"{BASE}/tracks/idea-validation")).json()
    assert first_track["steps"][4]["credit_source"] == "diagnostic"

    restarted = await send(client, "POST", "/diagnostic/restart")
    assert restarted.json()["status"] == "in_progress"
    assert restarted.json()["results"] == first["results"]
    late = await send(
        client, "PUT", "/diagnostic/draft",
        json={"answers": answers, "current_question_id": QUESTIONS[-1]["id"], "saved_at_ms": 1},
    )
    assert late.json()["answers"] == {}
    low_answers = {question["id"]: question.get("answer_key") or "Клиенты подтвердили потребность." for question in QUESTIONS}
    for question in QUESTIONS:
        if question["type"] in {"choice", "matching"}:
            low_answers[question["id"]] = "incorrect-answer"
    # Для ответов с выбором берём допустимый вариант, отличающийся от ключа.
    for question in QUESTIONS:
        if question["type"] == "choice":
            choices = question["options"]["choices"]
            low_answers[question["id"]] = next(choice["id"] for choice in choices if choice["id"] != question["answer_key"])
        elif question["type"] == "matching":
            left = question["options"]["left"]
            right = question["options"]["right"]
            low_answers[question["id"]] = {item["id"]: right[-1 - index]["id"] for index, item in enumerate(left)}
    pending_low = await send(client, "POST", "/diagnostic/submit", json={"answers": low_answers})
    assert pending_low.json()["status"] == "checking"
    assert pending_low.json()["results"] == first["results"]
    await process_pending_once(ai_client=ai)

    after = (await client.get(f"{BASE}/diagnostic")).json()
    new_score = next(row["score"] for row in after["results"] if row["track_id"] == "idea-validation")
    assert new_score < first_score
    track_after = (await client.get(f"{BASE}/tracks/idea-validation")).json()
    assert track_after["steps"][4]["credited"] and track_after["steps"][4]["credit_source"] == "diagnostic"
    assert track_after["required_count"] == first_track["required_count"]


async def test_late_draft_and_incorrect_lesson_retake_preserve_credit(client):
    await register(client)
    steps = TRACKS[0]["steps"]
    for step in steps[:2]:
        assert (await do_step(client, step)).status_code == 200
    step = steps[2]
    path = f"/learning/steps/{step['id']}"
    right = step["answer_key"]
    wrong = next(option["id"] for option in step["options"]["choices"] if option["id"] != right)
    now = time_ns() // 1_000_000

    saved = await send(client, "PUT", path + "/draft", json={"answer": right, "saved_at_ms": now})
    assert saved.json()["draft"] == right
    late = await send(client, "PUT", path + "/draft", json={"answer": wrong, "saved_at_ms": now - 100})
    assert late.json()["draft"] == right

    accepted = await send(
        client, "POST", path + "/submissions",
        json={"answer": right, "request_key": "correct", "saved_at_ms": now + 100},
    )
    assert accepted.status_code == 200 and accepted.json()["attempt"]["accepted"]
    late = await send(client, "PUT", path + "/draft", json={"answer": wrong, "saved_at_ms": now})
    assert late.json()["draft"] is None

    retried = await send(
        client, "POST", path + "/submissions",
        json={"answer": wrong, "request_key": "incorrect", "saved_at_ms": now + 200},
    )
    assert retried.status_code == 200 and retried.json()["attempt"]["accepted"] is False
    assert retried.json()["progress"] == accepted.json()["progress"]
    bundle = (await client.get(f"{BASE}/tracks/{TRACKS[0]['id']}/steps")).json()
    assert bundle["lessons"][2]["credit_source"] == "earned"
    assert bundle["lessons"][2]["last_attempt"]["accepted"] is False
    assert bundle["lessons"][3]["can_credit"]
