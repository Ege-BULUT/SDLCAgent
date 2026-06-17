"""Tests for .agentignore blacklist feature."""

import tempfile
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app
from app.rag.agentignore import read_agentignore, write_agentignore, is_ignored

client = TestClient(app)


def test_agentignore_round_trip():
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        patterns = ["backup/", "**/*.log", "temp.txt"]
        assert write_agentignore(root, patterns) is True
        assert read_agentignore(root) == patterns
        assert (root / ".agentignore").is_file()


def test_is_ignored_directory_pattern():
    assert is_ignored("backup/something.txt", ["backup/"]) is True
    assert is_ignored("src/backup/something.txt", ["backup/"]) is True
    assert is_ignored("src/main.py", ["backup/"]) is False


def test_is_ignored_recursive_glob():
    assert is_ignored("logs/app.log", ["**/*.log"]) is True
    assert is_ignored("debug.log", ["**/*.log"]) is True
    assert is_ignored("src/main.py", ["**/*.log"]) is False


def test_is_ignored_file_pattern():
    assert is_ignored("temp.txt", ["temp.txt"]) is True
    assert is_ignored("src/temp.txt", ["temp.txt"]) is True


def test_detect_structure_endpoint():
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        (root / "src").mkdir()
        (root / "backup").mkdir()
        (root / "README.md").write_text("# hi")
        (root / ".agentignore").write_text("backup/\n")

        res = client.post("/api/v1/rag/detect-structure", json={"repo_path": tmp})
        assert res.status_code == 200
        data = res.json()
        assert data["repo_path"] == tmp
        paths = {i["path"]: i for i in data["items"]}
        assert paths["backup"]["blacklisted"] is True
        assert paths["src"]["blacklisted"] is False
        assert data["patterns"] == ["backup/"]


def test_update_blacklist_endpoint():
    with tempfile.TemporaryDirectory() as tmp:
        res = client.post("/api/v1/rag/blacklist", json={"repo_path": tmp, "patterns": ["node_modules/", "*.tmp"]})
        assert res.status_code == 200
        data = res.json()
        assert data["saved"] is True
        assert set(data["patterns"]) == {"node_modules/", "*.tmp"}
        text = (Path(tmp) / ".agentignore").read_text(encoding="utf-8")
        assert "node_modules/" in text


def test_detect_languages_respects_blacklist():
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        (root / "src").mkdir()
        (root / "backup").mkdir()
        (root / "src" / "app.py").write_text("x = 1")
        (root / "backup" / "old.py").write_text("y = 2")
        (root / ".agentignore").write_text("backup/\n")

        res = client.post(f"/api/v1/rag/detect-languages?repo_path={tmp}")
        assert res.status_code == 200
        data = res.json()
        assert "python" in data["languages"]


def test_ingest_respects_blacklist():
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        (root / "src").mkdir()
        (root / "backup").mkdir()
        (root / "src" / "app.py").write_text("x = 1")
        (root / "backup" / "old.py").write_text("y = 2")
        (root / ".agentignore").write_text("backup/\n")

        res = client.post("/api/v1/rag/ingest", json={"repo_path": tmp, "languages": ["python"]})
        assert res.status_code == 200
        data = res.json()
        assert data["files_processed"] == 1
        assert any("app.py" in log for log in data["logs"])
        assert not any("old.py" in log for log in data["logs"])
