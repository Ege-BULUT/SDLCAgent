"""Verify stream_agent yields coder/reviewer tokens during LLM streaming."""

import asyncio
from unittest.mock import patch, AsyncMock, MagicMock

import pytest

from app.agent.streaming import stream_agent


async def fake_astream(*args, **kwargs):
    tokens = ["Plan: ", "\n", "[FILE: main.py]\ndef", " ", "hello", "():", "\n", "    pass", "\n[/FILE]"]
    for tok in tokens:
        class Chunk:
            content = tok
        yield Chunk()


@pytest.mark.asyncio
async def test_stream_agent_yields_tokens():
    fake_chain = MagicMock()
    fake_chain.astream = fake_astream

    fake_prompt = MagicMock()
    fake_prompt.__or__ = MagicMock(return_value=fake_chain)

    with (
        patch("app.agent.streaming.ChatOllama") as MockLLM,
        patch("app.agent.streaming.ChatPromptTemplate.from_messages", return_value=fake_prompt),
    ):
        MockLLM.return_value = MagicMock()

        events = []
        async for event in stream_agent(
            task="write hello function",
            language="python",
            coder_model="qwen2.5-coder:3b",
            reviewer_model="qwen2.5-coder:3b",
            max_iterations=1,
        ):
            events.append(event)

    types = [e.split('"type": "')[1].split('"')[0] for e in events]
    assert "node_start" in types
    assert "coder_token" in types
    assert types.count("coder_token") >= 6
    assert "node_end" in types
    assert "done" in types
