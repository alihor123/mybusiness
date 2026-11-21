from fastapi import HTTPException


def api_error(status: int, code: str, message: str) -> HTTPException:
    return HTTPException(status, detail={"code": code, "message": message})


def check_unavailable() -> HTTPException:
    return api_error(503, "CHECK_UNAVAILABLE", "Проверка временно недоступна. Повторите запрос.")
