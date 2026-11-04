"""Template parsing and placeholder filling. No template logic, only substitution."""
from __future__ import annotations

import re
from pathlib import Path
from typing import Any, Dict, List, Mapping, Optional, Tuple

from .errors import RefusalError, UsageError
from .ids import is_valid_item_id

PLACEHOLDER_RE = re.compile(r"\{\{\s*([a-z_]+)\s*\}\}")
FRONTMATTER_MARK = "---"
LIST_KEYS = ("regimes",)
DISCLAIMER = "This letter was prepared with Erase Me, an open-source tool. It is not legal advice."
REQUEST_PLACEHOLDERS = (
    "full_name", "email", "address_line", "today", "recipient_name", "recipient_email", "law_name",
    "law_short", "citation_erasure", "citation_objection", "citation_deadline", "deadline_days",
    "deadline_date", "listing_urls", "agent_name", "agent_relationship", "regulator_name",
    "regulator_url", "original_request_date", "reference", "operator_email", "citation_agent",
    "deadline_sentence", "deadline_sentence_past", "law_sentence", "law_basis", "escalation_sentence",
)
REQUIRED_META = ("id", "kind", "regimes", "subject")


def _parse_meta(lines: List[str]) -> Dict[str, Any]:
    meta: Dict[str, Any] = {}
    for line in lines:
        if not line.strip():
            continue
        key, sep, value = line.partition(":")
        if not sep or not key.strip():
            raise UsageError(f"Template frontmatter line '{line}' is not 'key: value'.")
        meta[key.strip()] = value.strip()
    for key in LIST_KEYS:
        if key in meta:
            meta[key] = [part.strip() for part in meta[key].split(",") if part.strip()]
    return meta


def parse_template(text: str) -> Dict[str, Any]:
    lines = text.lstrip("﻿").split("\n")
    if not lines or lines[0].strip() != FRONTMATTER_MARK:
        raise UsageError("Template must start with a --- frontmatter block.")
    try:
        end = next(i for i in range(1, len(lines)) if lines[i].strip() == FRONTMATTER_MARK)
    except StopIteration:
        raise UsageError("Template frontmatter is missing its closing ---.") from None
    return {"meta": _parse_meta(lines[1:end]), "body": "\n".join(lines[end + 1:])}


def placeholders(text: str) -> List[str]:
    return list(dict.fromkeys(PLACEHOLDER_RE.findall(text)))


def fill(text: str, values: Mapping[str, Optional[str]]) -> Tuple[str, List[str]]:
    """Single pass, so placeholders inside values are never expanded."""
    missing: List[str] = []

    def replace(match: "re.Match[str]") -> str:
        name = match.group(1)
        value = values.get(name)
        if value is None or value == "":
            if name not in missing:
                missing.append(name)
            return f"[[MISSING: {name}]]"
        return str(value)

    return PLACEHOLDER_RE.sub(replace, text), missing


def request_template_path(templates_root: Path, template_id: str) -> Path:
    if not is_valid_item_id(template_id):
        raise RefusalError(f"Template id '{template_id}' is not valid.")
    return templates_root / "requests" / f"{template_id}.md"


def load_request_template(templates_root: Path, template_id: str) -> Dict[str, Any]:
    path = request_template_path(templates_root, template_id)
    if not path.is_file():
        raise UsageError(f"No request template '{template_id}'. Expected it at {path}.")
    parsed = parse_template(path.read_text(encoding="utf-8"))
    return {"meta": parsed["meta"], "body": parsed["body"], "path": str(path)}


def load_text_template(templates_root: Path, name: str, fallback: str) -> str:
    path = templates_root / name
    if not path.is_file():
        return fallback
    return path.read_text(encoding="utf-8")
