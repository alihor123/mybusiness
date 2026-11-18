from fastapi import FastAPI

from app.auth.tokens import CSRF_HEADER

ERROR_SCHEMA = {
    "type": "object",
    "required": ["detail"],
    "properties": {
        "detail": {
            "type": "object",
            "required": ["code", "message"],
            "properties": {"code": {"type": "string"}, "message": {"type": "string"}},
        }
    },
}


def describe_errors(app: FastAPI) -> None:
    base_openapi = app.openapi

    def openapi():
        if app.openapi_schema is not None:
            return app.openapi_schema
        schema = base_openapi()
        for path, operations in schema["paths"].items():
            for method, operation in operations.items():
                responses = operation["responses"]
                protected = bool(operation.get("security"))
                if protected:
                    responses.setdefault("401", {"description": "Требуется активная сессия"})
                if protected and method in {"post", "put", "patch", "delete"}:
                    cookie = (
                        "csrf_refresh_token"
                        if path.endswith("/auth/refresh")
                        else "csrf_access_token"
                    )
                    operation.setdefault("parameters", []).append(
                        {
                            "name": CSRF_HEADER,
                            "in": "header",
                            "required": True,
                            "schema": {"type": "string"},
                            "description": f"Значение cookie {cookie}",
                        }
                    )
                    responses.setdefault("403", {"description": "Недействительный CSRF-токен"})
                if path.endswith(("/auth/register", "/auth/login")):
                    operation.setdefault("parameters", []).append(
                        {
                            "name": "Origin",
                            "in": "header",
                            "required": True,
                            "schema": {"type": "string"},
                            "description": "Публичный origin стенда",
                        }
                    )
                    responses.setdefault("403", {"description": "Недопустимый Origin"})
                if protected and {"diagnostic", "learning"}.intersection(operation.get("tags", [])):
                    responses["403"] = {"description": "Недостаточно прав или ошибка CSRF"}
                for status, response in responses.items():
                    if status in {"401", "403", "404", "409", "503"}:
                        response["content"] = {"application/json": {"schema": ERROR_SCHEMA}}
        return schema

    app.openapi = openapi
