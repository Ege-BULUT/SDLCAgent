"""Verify the SSE streaming endpoint delivers events incrementally."""

import asyncio
import time
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


async def fake_stream_agent(*args, **kwargs):
    """Yield 10 events over ~0.5 seconds."""
    for i in range(10):
        await asyncio.sleep(0.05)
        yield f"data: {{\"type\": \"coder_token\", \"text\": \"tok{i}\", \"iteration\": 1}}\n\n"
    yield "data: {\"type\": \"done\", \"iterations\": 1, \"is_valid\": true, \"draft_code\": \"ok\", \"review_feedback\": \"PASS\", \"files\": {}}\n\n"


def test_sse_streaming_is_incremental():
    with patch("app.main.stream_agent", fake_stream_agent):
        start = time.perf_counter()
        resp = client.post(
            "/api/v1/agent/generate/stream",
            json={
                "task": "hello",
                "language": "python",
                "coder_model": "qwen2.5-coder:3b",
                "reviewer_model": "qwen2.5-coder:3b",
                "max_iterations": 1,
            },
        )
        elapsed = time.perf_counter() - start

    assert resp.status_code == 200
    text = resp.text
    assert text.count("coder_token") == 10
    assert "done" in text
    assert elapsed >= 0.3, f"Expected incremental stream over >=0.3s, got {elapsed:.3f}s"
