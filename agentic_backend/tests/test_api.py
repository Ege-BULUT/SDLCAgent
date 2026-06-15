import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.config import settings

client = TestClient(app)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["version"] == settings.VERSION
    assert data["project_name"] == settings.PROJECT_NAME
    assert len(data["available_models"]) > 0


def test_list_models():
    response = client.get("/api/v1/models")
    assert response.status_code == 200
    data = response.json()
    assert "current_coder" in data
    assert "current_reviewer" in data
    assert "available_models" in data
    assert len(data["available_models"]) > 0


def test_rag_ingest_invalid_path():
    response = client.post("/api/v1/rag/ingest", json={
        "repo_path": "/nonexistent/path",
        "languages": ["python"],
    })
    assert response.status_code == 400


def test_rag_ingest_valid():
    response = client.post("/api/v1/rag/ingest", json={
        "repo_path": "data/test_codebase",
        "languages": ["py", "ts"],
    })
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["files_processed"] >= 2
    assert data["chunks_created"] > 0


def test_rag_stats():
    client.post("/api/v1/rag/ingest", json={
        "repo_path": "data/test_codebase",
        "languages": ["py"],
    })
    response = client.get("/api/v1/rag/stats")
    assert response.status_code == 200
    data = response.json()
    assert data["total_chunks"] > 0
    assert data["total_files"] >= 1


def test_rag_clear():
    client.post("/api/v1/rag/ingest", json={
        "repo_path": "data/test_codebase",
        "languages": ["py"],
    })
    response = client.post("/api/v1/rag/clear")
    assert response.status_code == 200
    assert response.json()["status"] == "cleared"
    stats = client.get("/api/v1/rag/stats").json()
    assert stats["total_chunks"] == 0


def test_agent_generate_invalid_coder_model():
    response = client.post("/api/v1/agent/generate", json={
        "task": "Write hello world",
        "language": "python",
        "coder_model": "nonexistent-model",
    })
    assert response.status_code == 400
    assert "Unknown coder model" in response.json()["detail"]


@pytest.mark.skipif(
    True,
    reason="Integration test :requires Ollama running with model loaded",
)
def test_agent_generate_simple():
    response = client.post("/api/v1/agent/generate", json={
        "task": "Write a Python function that returns 'Hello, World!'",
        "language": "python",
        "max_iterations": 1,
    })
    assert response.status_code == 200
    data = response.json()
    assert "draft_code" in data
    assert data["iterations"] >= 1
    assert isinstance(data["logs"], list)
    assert len(data["logs"]) > 0


def test_agent_generate_empty_task():
    response = client.post("/api/v1/agent/generate", json={
        "task": "",
        "language": "python",
    })
    assert response.status_code == 422


def test_agent_generate_unknown_reviewer():
    response = client.post("/api/v1/agent/generate", json={
        "task": "Write hello world",
        "language": "python",
        "reviewer_model": "unknown-model",
    })
    assert response.status_code == 400
