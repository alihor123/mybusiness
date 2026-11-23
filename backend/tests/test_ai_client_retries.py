from types import SimpleNamespace

import httpx
import pytest
from openai import APIStatusError
from pydantic import BaseModel

from app.ai.client import CheckUnavailable, DeepSeekClient


class Result(BaseModel):
    value: str


class CompletionsStub:
    def __init__(self, responses):
        self.responses = iter(responses)
        self.calls = 0

    async def create(self, **kwargs):
        self.calls += 1
        response = next(self.responses)
        if isinstance(response, Exception):
            raise response
        return response


def make_client(responses, retries=2):
    client = DeepSeekClient.__new__(DeepSeekClient)
    client.settings = SimpleNamespace(
        deepseek_max_retries=retries,
        deepseek_timeout_seconds=1,
        deepseek_model="test-model",
        deepseek_max_output_tokens=100,
        deepseek_thinking=False,
    )
    completions = CompletionsStub(responses)
    client.client = SimpleNamespace(
        chat=SimpleNamespace(completions=completions)
    )
    return client, completions


def make_response(content, finish_reason="stop"):
    return SimpleNamespace(
        choices=[
            SimpleNamespace(
                finish_reason=finish_reason,
                message=SimpleNamespace(content=content),
            )
        ]
    )


def make_status_error(status):
    request = httpx.Request("POST", "https://provider.invalid")
    response = httpx.Response(status, request=request)
    return APIStatusError("provider error", response=response, body=None)


@pytest.mark.asyncio
async def test_retries_transient_status_and_recovers(monkeypatch):
    client, completions = make_client(
        [make_status_error(503), make_response('{"value":"ok"}')]
    )
    monkeypatch.setattr(client, "_retry_delay", lambda *_: 0)

    result = await client.complete("instructions", "data", Result)

    assert result.value == "ok"
    assert completions.calls == 2


@pytest.mark.asyncio
async def test_does_not_retry_non_transient_status(monkeypatch):
    client, completions = make_client([make_status_error(401)])
    monkeypatch.setattr(client, "_retry_delay", lambda *_: 0)

    with pytest.raises(CheckUnavailable):
        await client.complete("instructions", "data", Result)

    assert completions.calls == 1


@pytest.mark.asyncio
async def test_retries_invalid_json_response(monkeypatch):
    client, completions = make_client(
        [make_response("not json"), make_response('{"value":"ok"}')]
    )
    monkeypatch.setattr(client, "_retry_delay", lambda *_: 0)

    result = await client.complete("instructions", "data", Result)

    assert result.value == "ok"
    assert completions.calls == 2


@pytest.mark.asyncio
async def test_retry_count_is_bounded(monkeypatch):
    client, completions = make_client(
        [make_status_error(503), make_status_error(503), make_status_error(503)],
        retries=2,
    )
    monkeypatch.setattr(client, "_retry_delay", lambda *_: 0)

    with pytest.raises(CheckUnavailable):
        await client.complete("instructions", "data", Result)

    assert completions.calls == 3
