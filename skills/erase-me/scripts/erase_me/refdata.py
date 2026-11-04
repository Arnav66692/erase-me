"""Loading JSON files from the references folder."""
from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List

from . import storage
from .errors import UsageError


def load_folder(folder: Path) -> List[Dict[str, Any]]:
    """Load every *.json file in folder. A missing folder means no data."""
    if not folder.is_dir():
        return []
    loaded = []
    for path in sorted(folder.glob("*.json")):
        data = storage.read_json(path)
        if not isinstance(data, dict):
            raise UsageError(f"{path} must contain a JSON object.")
        loaded.append(data)
    return loaded
