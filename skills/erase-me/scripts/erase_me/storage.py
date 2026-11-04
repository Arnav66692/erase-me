"""Private, atomic file writes and friendly JSON reads."""
from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path
from typing import Any

from .errors import UsageError
from .paths import FILE_MODE

TEMP_PREFIX = ".tmp-"


def write_text_private(path: Path, text: str) -> Path:
    """Write text through a temp file and os.replace so readers never see half a file."""
    return write_bytes_private(path, text.encode("utf-8"))


def write_bytes_private(path: Path, data: bytes) -> Path:
    """Temp file (mode 600 from the start), fsync, then os.replace. Never chmod after the replace."""
    fd, temp_name = tempfile.mkstemp(dir=str(path.parent), prefix=TEMP_PREFIX)
    try:
        with os.fdopen(fd, "wb") as handle:
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
        os.chmod(temp_name, FILE_MODE)
        os.replace(temp_name, path)
    except BaseException:
        if os.path.exists(temp_name):
            os.unlink(temp_name)
        raise
    return path


def append_line_private(path: Path, line: str) -> Path:
    """Append one line to an append-only log, created with mode 600."""
    fd = os.open(str(path), os.O_WRONLY | os.O_APPEND | os.O_CREAT, FILE_MODE)
    try:
        os.fchmod(fd, FILE_MODE)
        os.write(fd, (line.rstrip("\n") + "\n").encode("utf-8"))
        os.fsync(fd)
    finally:
        os.close(fd)
    return path


def dumps(data: Any) -> str:
    return json.dumps(data, indent=2, ensure_ascii=False) + "\n"


def write_json_private(path: Path, data: Any) -> Path:
    return write_text_private(path, dumps(data))


def read_json(path: Path, what: str = "") -> Any:
    label = what or path.name
    if not path.is_file():
        raise UsageError(f"Could not find the {label} file at {path}.")
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (ValueError, UnicodeDecodeError) as exc:
        raise UsageError(f"The {label} file at {path} is not valid JSON: {exc}") from exc


def read_json_optional(path: Path, default: Any = None) -> Any:
    if not path.is_file():
        return default
    return read_json(path)
