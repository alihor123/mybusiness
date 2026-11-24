import asyncio
from uuid import UUID, uuid4

from conftest import access_csrf, open_client, register
from sqlalchemy import select, update

from app.ai.client import CheckUnavailable, get_deepseek
from app.auth.models import Role, User
from app.auth.tokens import utcnow
from app.database import get_session_factory
from app.learning.models import Completion
from app.main import app
from app.mentors.models import Mentor

API = "/api/v1"


async def teacher(client):
    user = await register(client)
    user_id = UUID(user["id"])
    async with get_session_factory()() as db, db.begin():
        role_id = await db.scalar(select(Role.id).where(Role.code == "teacher"))
        await db.execute(update(User).where(User.id == user_id).values(role_id=role_id))
        mentor = Mentor(
            user_id=user_id,
            stable_key=str(uuid4()),
            name="Наставник",
            headline="Тест",
            about="Тест",
            experience_label="Тест",
            experience_anchor_year=2020,
            industry_codes=["food_service"],
            project_stage_codes=["idea"],
            help_topics=["Клиенты"],
            meeting_format="online",
            bio_sources=[],
            portrait_url="/media/test.jpg",
            contacts={},
        )
        db.add(mentor)
        await db.flush()
        return str(mentor.id)


async def test_project_mentoring_flow(client, tmp_path, monkeypatch):
    monkeypatch.setenv("PRIVATE_UPLOAD_DIR", str(tmp_path))
    owner_id = UUID((await register(client))["id"])
    headers = access_csrf(client)
    async with get_session_factory()() as db, db.begin():
        db.add(
            Completion(
                user_id=owner_id,
                first_project_id=uuid4(),
                project_prefill={},
                completed_at=utcnow(),
            )
        )

    response = await client.post(f"{API}/projects", headers=headers)
    assert response.status_code == 201, response.text
    assert response.json()["project_audience"] == "student"
    project = f"{API}/projects/{response.json()['id']}"
    payload = {
        "title": "Пилот",
        "industry": "food_service",
        "stage": "idea",
        "project_audience": "startup",
        "audience": "Студенты",
        "problem": "Очередь",
        "solution_benefit": "Быстрая выдача",
        "mentor_request": "Проверить спрос",
    }

    class Offline:
        async def complete(self, *args):
            raise CheckUnavailable("offline")

    app.dependency_overrides[get_deepseek] = Offline
    async with open_client() as a, open_client() as b, open_client() as stranger:
        aid, bid = await teacher(a), await teacher(b)
        await teacher(stranger)
        recommendation = await client.post(
            f"{project}/mentor-recommendations", headers=headers, json=payload
        )
        assert recommendation.status_code == 503, recommendation.text

        prompts = []

        class Available:
            async def complete(self, instructions, prompt, schema):
                prompts.append(prompt)
                return schema.model_validate(
                    {
                        "recommendations": [
                            {"mentor_id": aid, "reason": "Отрасль совпадает"},
                            {"mentor_id": aid, "reason": "Повтор"},
                            {"mentor_id": str(uuid4()), "reason": "Неизвестный ID"},
                            {"mentor_id": bid, "reason": "Подходит для стадии"},
                        ]
                    }
                )

        app.dependency_overrides[get_deepseek] = Available
        response = await client.post(
            f"{project}/mentor-recommendations", headers=headers, json=payload
        )
        assert response.status_code == 200, response.text
        assert [row["mentor_id"] for row in response.json()["recommendations"]] == [aid, bid]
        assert '"project_audience": "startup"' in prompts[-1]
        app.dependency_overrides[get_deepseek] = Offline
        rows = []
        for mentor_id in (aid, bid):
            response = await client.post(
                f"{project}/applications", headers=headers, json={"mentor_id": mentor_id}
            )
            assert response.status_code == 201, response.text
            rows.append(response.json())
        dupe = await client.post(
            f"{project}/applications", headers=headers, json={"mentor_id": aid}
        )
        assert dupe.status_code == 409
        form = await client.patch(project, headers=headers, json={"title": "Пилот 2"})
        version = form.json()["questionnaire_version"]
        for browser, row in ((a, rows[0]), (b, rows[1])):
            detail = await browser.get(f"{API}/applications/{row['id']}")
            assert detail.json()["project"]["questionnaire_version"] == version
            assert detail.json()["project"]["project_audience"] == "startup"
        stale = await a.post(
            f"{API}/applications/{rows[0]['id']}/decision",
            headers=access_csrf(a),
            json={"decision": "accept", "questionnaire_version": version - 1},
        )
        assert stale.status_code == 409
        decided = await asyncio.gather(
            *(
                browser.post(
                    f"{API}/applications/{row['id']}/decision",
                    headers=access_csrf(browser),
                    json={"decision": "accept", "questionnaire_version": version},
                )
                for browser, row in ((a, rows[0]), (b, rows[1]))
            )
        )
        assert sorted(item.status_code for item in decided) == [200, 409]
        mentor = a if decided[0].status_code == 200 else b
        mentor_headers = access_csrf(mentor)
        applications = (await client.get(f"{project}/applications")).json()
        assert {row["status"] for row in applications} == {"accepted", "closed_selected_other"}
        plan = (await client.get(f"{project}/tasks")).json()
        assert len(plan["tasks"]) == 5
        assert plan["tasks"][1]["title"] == "Проведите интервью о проблеме"
        locked_audience = await client.patch(
            project, headers=headers, json={"project_audience": "self_employed"}
        )
        assert locked_audience.status_code == 409, locked_audience.text
        assert (await client.get(project)).json()["project_audience"] == "startup"
        updated_profile = await client.patch(
            f"{API}/me", headers=headers, json={"audience": "self_employed"}
        )
        assert updated_profile.json()["audience"] == "self_employed"
        assert (await client.get(f"{project}/tasks")).json()["tasks"] == plan["tasks"]
        next_project = await client.post(f"{API}/projects", headers=headers)
        assert next_project.status_code == 201
        assert next_project.json()["project_audience"] == "self_employed"
        task = f"{API}/tasks/{plan['tasks'][2]['id']}"

        def pdf(name):
            return {"file": (name, b"%PDF-1.4\nfixture", "application/pdf")}

        pending = await client.put(
            f"{task}/draft",
            headers=headers,
            data={"file_action": "replace", "file_only": "true", "saved_at_ms": "20"},
            files=pdf("v1.pdf"),
        )
        assert pending.status_code == 200, pending.text
        attachment = f"{API}/attachments/{pending.json()['draft_attachment']['id']}"
        saved_text = await client.put(
            f"{task}/draft", headers=headers,
            data={"text": "Версия 1", "saved_at_ms": "30"},
        )
        assert saved_text.json()["draft_text"] == "Версия 1"
        stale_text = await client.put(
            f"{task}/draft", headers=headers,
            data={"text": "Ранний снимок", "saved_at_ms": "25"},
        )
        assert stale_text.json()["draft_text"] == "Версия 1"
        stale_file = await client.put(
            f"{task}/draft", headers=headers,
            data={"file_action": "remove", "file_only": "true", "saved_at_ms": "18"},
        )
        assert attachment.endswith(stale_file.json()["draft_attachment"]["id"])
        assert (await mentor.get(attachment)).status_code == 404
        assert (
            await client.post(f"{task}/preview-check", headers=headers, json={"text": "Версия 1"})
        ).status_code == 503
        first = await client.post(
            f"{task}/submissions",
            headers=headers,
            data={"text": "Версия 1", "request_key": "try-1", "file_action": "keep", "saved_at_ms": "40"},
        )
        assert first.status_code == 200, first.text
        first_id = first.json()["submissions"][0]["id"]
        assert (await stranger.get(attachment)).status_code == 404
        returned = await mentor.post(
            f"{API}/submissions/{first_id}/decision",
            headers=mentor_headers,
            json={"decision": "revision_requested", "comment": "Добавь критерий"},
        )
        assert returned.status_code == 200, returned.text
        returned_task = await client.get(task)
        assert returned_task.json()["status"] == "revision_requested"
        assert returned_task.json()["draft_text"]
        assert "submit" in returned_task.json()["allowed_actions"]
        late = await client.put(
            f"{task}/draft", headers=headers,
            data={"text": "Ранний снимок", "saved_at_ms": "35"},
        )
        assert late.json()["draft_text"]
        edited = await client.put(
            f"{task}/draft", headers=headers,
            data={"text": "Revised answer 2", "saved_at_ms": "50"},
        )
        assert edited.json()["draft_text"] == "Revised answer 2"
        second = await client.post(
            f"{task}/submissions",
            headers=headers,
            data={"text": "Revised answer 2", "request_key": "try-2", "file_action": "replace"},
            files=pdf("v2.pdf"),
        )
        assert second.status_code == 200, second.text
        attempts = (await mentor.get(task)).json()["submissions"]
        assert {item["number"] for item in attempts} == {1, 2}
        second_id = next(item["id"] for item in attempts if item["number"] == 2)
        accepted = await mentor.post(
            f"{API}/submissions/{second_id}/decision",
            headers=mentor_headers,
            json={"decision": "accept"},
        )
        assert accepted.json()["accepted_count"] == 1, accepted.text
        for i in (0, 1, 3, 4):
            task_id = plan["tasks"][i]["id"]
            submitted = await client.post(
                f"{API}/tasks/{task_id}/submissions",
                headers=headers,
                data={"text": "Готово", "request_key": "done"},
            )
            assert submitted.status_code == 200, submitted.text
            sid = submitted.json()["submissions"][0]["id"]
            accepted = await mentor.post(
                f"{API}/submissions/{sid}/decision",
                headers=mentor_headers,
                json={"decision": "accept"},
            )
            assert accepted.status_code == 200, accepted.text
        assert accepted.json()["plan_completed"]
        assert (await client.post(f"{project}/archive", headers=headers)).status_code == 200
        assert (await mentor.get(attachment)).status_code == 200
        assert (
            await client.patch(project, headers=headers, json={"title": "Закрыт"})
        ).status_code == 409
