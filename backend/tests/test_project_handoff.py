from uuid import UUID, uuid4

from conftest import access_csrf, register

from app.auth.tokens import utcnow
from app.database import get_session_factory
from app.learning.models import Completion
from app.projects.bootstrap import ProjectPrefill
from app.projects.service import ensure_first_project


async def test_first_project_edit_and_delete_do_not_reset_learning(client):
    owner = await register(client)
    user_id = UUID(owner["id"])
    base = "/api/v1/projects"
    headers = access_csrf(client)
    assert (await client.post(base, headers=headers)).status_code == 409
    completion = uuid4()
    prefill = ProjectPrefill(title="Чай между парами", solution="Быстрая выдача")
    async with get_session_factory()() as db, db.begin():
        first_id = await ensure_first_project(
            db, user_id=user_id, completion_id=completion, project_prefill=prefill
        )
        db.add(
            Completion(
                id=completion,
                user_id=user_id,
                first_project_id=first_id,
                project_prefill=prefill.model_dump(exclude_none=True),
                completed_at=utcnow(),
            )
        )

    progress = (await client.get("/api/v1/learning/progress")).json()
    assert progress["draft_project_id"] == progress["first_project_id"] == str(first_id)
    first_url = f"{base}/{first_id}"
    draft = (await client.get(first_url)).json()
    assert draft["solution_benefit"] == "Быстрая выдача"
    assert draft["mentor_request"] is None
    response = await client.patch(first_url, headers=headers, json={"title": "Новая версия"})
    assert response.status_code == 200
    assert response.json()["questionnaire_version"] == 2

    async with get_session_factory()() as db, db.begin():
        assert (
            await ensure_first_project(
                db, user_id=user_id, completion_id=completion, project_prefill=prefill
            )
            == first_id
        )
    assert (await client.get(first_url)).json()["title"] == "Новая версия"

    assert (await client.delete(first_url, headers=headers)).status_code == 204
    async with get_session_factory()() as db, db.begin():
        assert (
            await ensure_first_project(
                db, user_id=user_id, completion_id=completion, project_prefill=prefill
            )
            == first_id
        )
    assert (await client.get(first_url)).status_code == 404
    after = (await client.get("/api/v1/learning/progress")).json()
    assert after["can_create_project"] and after["draft_project_id"] is None
    new_project = await client.post(base, headers=headers)
    assert new_project.status_code == 201
    assert new_project.json()["id"] != str(first_id)
    assert new_project.json()["title"] is None
