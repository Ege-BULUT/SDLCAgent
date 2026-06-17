""".agentignore parser and path matcher.

Stores blacklist patterns in a `.agentignore` file at the repo root.
Supports simple glob-style patterns similar to .gitignore:
  - `folder/` matches any directory named folder
  - `*.md` matches markdown files in the root only
  - `**/*.md` matches markdown files recursively
  - `backup/` matches the backup directory anywhere
"""

from __future__ import annotations

import fnmatch
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

DEFAULT_AGENTIGNORE = """# SDLCAgent ignore file — add folders/files to exclude from RAG/code context.
# Syntax: simple glob-style patterns, one per line. Blank lines and # comments are ignored.
# Examples:
#   backup/
#   **/*.log
#   node_modules/
"""


def read_agentignore(repo_path: str | Path) -> list[str]:
    """Return active patterns from .agentignore, or [] if absent."""
    path = Path(repo_path) / ".agentignore"
    if not path.is_file():
        return []
    try:
        text = path.read_text(encoding="utf-8", errors="ignore")
    except Exception as e:
        logger.warning("Failed to read %s: %s", path, e)
        return []
    patterns: list[str] = []
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        patterns.append(stripped)
    return patterns


def write_agentignore(repo_path: str | Path, patterns: list[str]) -> bool:
    """Write patterns to .agentignore, preserving the default header."""
    path = Path(repo_path) / ".agentignore"
    try:
        lines = [DEFAULT_AGENTIGNORE.strip(), ""] + [p for p in patterns if p.strip()]
        path.write_text("\n".join(lines) + "\n", encoding="utf-8")
        return True
    except Exception as e:
        logger.error("Failed to write %s: %s", path, e)
        return False


def _path_to_parts(relative: str) -> list[str]:
    return [p for p in relative.replace("\\", "/").split("/") if p]


def is_ignored(relative_path: str, patterns: list[str]) -> bool:
    """Check whether a path relative to the repo root matches any pattern.

    - Patterns ending with `/` match directories at any depth.
    - `**/` prefix matches any number of directory levels.
    - Other patterns match files relative to root or at any depth for directory-named patterns.
    """
    rel_unix = relative_path.replace("\\", "/").lstrip("/")
    parts = _path_to_parts(rel_unix)
    if not parts:
        return False

    is_dir = relative_path.endswith("/")
    name = parts[-1]

    for pattern in patterns:
        p = pattern.strip()
        if not p:
            continue

        # Directory pattern: match any path segment or prefix
        if p.endswith("/"):
            dir_name = p.rstrip("/")
            if dir_name in parts:
                return True
            # Also match a path that starts with this dir at root
            if parts and parts[0] == dir_name:
                return True
            continue

        # Recursive glob
        if p.startswith("**/"):
            suffix = p[3:]
            if fnmatch.fnmatch(name, suffix):
                return True
            # Check any intermediate segment
            for part in parts:
                if fnmatch.fnmatch(part, suffix):
                    return True
            continue

        # Plain root-relative glob or filename glob anywhere
        if fnmatch.fnmatch(rel_unix, p):
            return True
        if fnmatch.fnmatch(name, p):
            return True

    return False
