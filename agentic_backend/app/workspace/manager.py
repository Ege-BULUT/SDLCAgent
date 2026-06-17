import json, logging, os, shutil, time, uuid
from pathlib import Path
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

WORKSPACE_DIR = Path(".workspace")
SESSION_TTL_HOURS = 24
GC_INTERVAL_HOURS = 1


def _session_path(session_id: str) -> Path:
    return WORKSPACE_DIR / session_id


def _files_path(session_id: str) -> Path:
    return _session_path(session_id) / "files.json"


def _lock_path(session_id: str) -> Path:
    return _session_path(session_id) / ".lock"


def _backup_dir(session_id: str) -> Path:
    return _session_path(session_id) / "backups"


def _applied_flag(session_id: str) -> Path:
    return _session_path(session_id) / ".applied"


def create_session() -> str:
    session_id = "ses_" + uuid.uuid4().hex[:12]
    sess_dir = _session_path(session_id)
    sess_dir.mkdir(parents=True, exist_ok=True)
    data = {
        "session_id": session_id,
        "created_at": datetime.now().isoformat(),
        "last_heartbeat": datetime.now().isoformat(),
        "files": {},
    }
    _write_files(session_id, data)
    _touch_lock(session_id)
    logger.info("Workspace session created: %s", session_id)
    return session_id


def heartbeat(session_id: str) -> bool:
    data = _read_files(session_id)
    if data is None:
        return False
    data["last_heartbeat"] = datetime.now().isoformat()
    _write_files(session_id, data)
    _touch_lock(session_id)
    return True


def set_files(session_id: str, files: dict[str, str]) -> bool:
    data = _read_files(session_id)
    if data is None:
        return False
    data["files"] = {}
    for path, content in files.items():
        original = _read_original(path) if os.path.isfile(path) else None
        data["files"][path] = {"content": content, "original": original}
    _write_files(session_id, data)
    _touch_lock(session_id)
    logger.info("Session %s: %d files set", session_id, len(files))
    return True


def get_file_tree(session_id: str) -> dict | None:
    data = _read_files(session_id)
    if data is None:
        return None
    return {
        "session_id": data["session_id"],
        "files": list(data["files"].keys()),
        "file_count": len(data["files"]),
        "has_backups": any(f.get("original") for f in data["files"].values()),
        "applied": _applied_flag(session_id).exists(),
    }


def get_file_content(session_id: str, filepath: str) -> str | None:
    data = _read_files(session_id)
    if data is None:
        return None
    info = data["files"].get(filepath)
    if info is None:
        return None
    return info["content"]


def apply_files(session_id: str, base_dir: str | None = None) -> dict:
    data = _read_files(session_id)
    if data is None:
        return {"ok": False, "error": "Session not found"}

    applied = []
    errors = []
    base = Path(base_dir).resolve() if base_dir else Path.cwd()

    for filepath, info in data["files"].items():
        try:
            target = base / filepath
            target.parent.mkdir(parents=True, exist_ok=True)
            # Backup original if not already backed up
            if info.get("original") is not None:
                back = _backup_dir(session_id) / filepath
                back.parent.mkdir(parents=True, exist_ok=True)
                if not back.exists():
                    shutil.copy2(str(target), str(back))
                    logger.debug("Backed up %s -> %s", target, back)
            # Write new content
            target.write_text(info["content"], encoding="utf-8")
            applied.append(filepath)
            logger.info("Applied %s", target)
        except Exception as e:
            errors.append({"file": filepath, "error": str(e)})
            logger.error("Failed to apply %s: %s", filepath, e)

    if applied:
        _applied_flag(session_id).touch()

    return {"ok": len(errors) == 0, "applied": applied, "errors": errors}


def revert_files(session_id: str, base_dir: str | None = None) -> dict:
    back_dir = _backup_dir(session_id)
    if not back_dir.is_dir():
        return {"ok": False, "error": "No backups found for this session"}

    reverted = []
    errors = []
    base = Path(base_dir).resolve() if base_dir else Path.cwd()

    for backup_file in back_dir.rglob("*"):
        if not backup_file.is_file():
            continue
        rel_path = backup_file.relative_to(back_dir)
        target = base / rel_path
        try:
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(str(backup_file), str(target))
            reverted.append(str(rel_path))
            logger.info("Reverted %s from backup", target)
        except Exception as e:
            errors.append({"file": str(rel_path), "error": str(e)})
            logger.error("Failed to revert %s: %s", rel_path, e)

    if reverted:
        _applied_flag(session_id).unlink(missing_ok=True)

    return {"ok": len(errors) == 0, "reverted": reverted, "errors": errors}


def cleanup_stale_sessions(max_age_hours: int = SESSION_TTL_HOURS) -> dict:
    if not WORKSPACE_DIR.is_dir():
        return {"cleaned": 0, "skipped_active": 0}
    now = time.time()
    cleaned = 0
    skipped = 0
    for entry in WORKSPACE_DIR.iterdir():
        if not entry.is_dir():
            continue
        sid = entry.name
        lock = _lock_path(sid)
        # Skip if lock is recent (session active)
        if lock.exists() and (now - lock.stat().st_mtime) < max_age_hours * 3600:
            skipped += 1
            continue
        # Also check heartbeat age
        data = _read_files(sid)
        if data:
            hb = data.get("last_heartbeat", "")
            try:
                hb_time = datetime.fromisoformat(hb).timestamp()
                if (now - hb_time) < max_age_hours * 3600:
                    skipped += 1
                    continue
            except (ValueError, TypeError):
                pass
        shutil.rmtree(str(entry), ignore_errors=True)
        cleaned += 1
        logger.info("Cleaned up stale session: %s", sid)
    return {"cleaned": cleaned, "skipped_active": skipped}


def _read_files(session_id: str) -> dict | None:
    fp = _files_path(session_id)
    if not fp.is_file():
        return None
    try:
        return json.loads(fp.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as e:
        logger.error("Failed to read workspace files: %s", e)
        return None


def _write_files(session_id: str, data: dict):
    fp = _files_path(session_id)
    fp.parent.mkdir(parents=True, exist_ok=True)
    fp.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


def _touch_lock(session_id: str):
    _lock_path(session_id).touch()


def _read_original(filepath: str) -> str | None:
    try:
        return Path(filepath).read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return None
