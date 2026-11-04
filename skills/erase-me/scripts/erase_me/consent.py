"""Consent records. Nothing that touches a person's data runs without one."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any, Dict, Optional

from . import clock, paths, storage
from .errors import RefusalError, UsageError
from .ids import validate_person_id
from .profile import EMAIL_RE

RELATIONSHIPS = ("self", "parent", "spouse", "sibling", "child", "grandparent", "other_family")
METHODS = ("self", "verbal", "written", "signed_authorization")
SELF = "self"
SIGNED = "signed_authorization"
MAX_AGENT_NAME = 120
MAX_AUTHORIZATION_BYTES = 20 * 1024 * 1024
AUTHORIZATION_EXTENSIONS = (".pdf", ".png", ".jpg", ".jpeg", ".heic", ".txt")
NEUTRAL_EXTENSION = ".bin"


def _check_choice(value: object, allowed: tuple, label: str) -> str:
    if value not in allowed:
        raise UsageError(f"Unknown {label} '{value}'. Use one of: {', '.join(allowed)}.")
    return str(value)


def _check_pairing(relationship: str, method: str) -> None:
    if relationship == SELF and method != SELF:
        raise UsageError("When the person is you, use --method self.")
    if relationship != SELF and method == SELF:
        raise UsageError("For a family member, use --method verbal, written or signed_authorization.")


def _authorization(method: str, authorization_file: Optional[str]) -> Dict[str, Optional[str]]:
    if authorization_file is None:
        if method == SIGNED:
            raise UsageError("A signed authorization needs --authorization-file pointing at the signed copy.")
        return {"authorization_file": None, "authorization_sha256": None}
    path = Path(authorization_file).expanduser()
    if not path.is_file():
        raise UsageError(f"The authorization file {path} does not exist.")
    if path.stat().st_size > MAX_AUTHORIZATION_BYTES:
        raise UsageError(f"The authorization file is larger than {MAX_AUTHORIZATION_BYTES // (1024 * 1024)} MB.")
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    return {"authorization_file": str(path.resolve()), "authorization_sha256": digest}


def _clean_agent_name(agent_name: Optional[str]) -> Optional[str]:
    if agent_name is None:
        return None
    cleaned = " ".join(agent_name.split())
    if not cleaned or len(cleaned) > MAX_AGENT_NAME:
        raise UsageError(f"Agent name must be 1 to {MAX_AGENT_NAME} characters.")
    return cleaned


def _clean_email(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    cleaned = value.strip().lower()
    if not EMAIL_RE.fullmatch(cleaned):
        raise UsageError(f"'{value}' does not look like an email address.")
    return cleaned


def _statement(relationship: str, agent_name: Optional[str]) -> str:
    if relationship == SELF:
        return "I agree to search for and request removal of my own personal data with Erase Me."
    who = agent_name or "my family member"
    return f"I agree that {who} may search for and request removal of my personal data."


def build_consent(
    person_id: str,
    relationship: str,
    method: str,
    authorization_file: Optional[str] = None,
    agent_name: Optional[str] = None,
    operator_email: Optional[str] = None,
) -> Dict[str, Any]:
    validate_person_id(person_id)
    relationship = _check_choice(relationship, RELATIONSHIPS, "relationship")
    method = _check_choice(method, METHODS, "method")
    _check_pairing(relationship, method)
    agent = _clean_agent_name(agent_name)
    if relationship != SELF and agent is None:
        raise UsageError("For a family member, pass --agent-name with the name of the person running Erase Me.")
    record = {
        "person_id": person_id,
        "relationship": relationship,
        "method": method,
        "consented_on": clock.today().isoformat(),
        **_authorization(method, authorization_file),
        "agent_name": agent,
        "operator_email": _clean_email(operator_email),
        "statement": _statement(relationship, agent),
        "recorded_at": clock.now_iso(),
    }
    return record


def _copy_authorization(person_id: str, record: Dict[str, Any]) -> Dict[str, Any]:
    """Keep a private copy of the signed authorization next to the consent record."""
    source = record.get("authorization_file")
    if not source:
        return record
    data = Path(source).read_bytes()
    if hashlib.sha256(data).hexdigest() != record.get("authorization_sha256"):
        raise UsageError("The authorization file changed while it was being recorded. Run consent again.")
    suffix = Path(source).suffix.lower()
    target = paths.person_dir(person_id) / f"authorization{suffix if suffix in AUTHORIZATION_EXTENSIONS else NEUTRAL_EXTENSION}"
    storage.write_bytes_private(target, data)
    return dict(record, authorization_file=str(target))


def _log(person_id: str, record: Dict[str, Any], action: str) -> None:
    entry = {
        "at": record.get("recorded_at"), "action": action, "relationship": record.get("relationship"),
        "method": record.get("method"), "consented_on": record.get("consented_on"),
        "agent_name": record.get("agent_name"), "authorization_sha256": record.get("authorization_sha256"),
    }
    storage.append_line_private(paths.consent_log_path(person_id), json.dumps(entry, ensure_ascii=False))


def save_consent(record: Dict[str, Any], replace: bool = False) -> Path:
    """Write consent.json once. Replacing needs replace=True. Every write is appended to consent_log.jsonl."""
    person_id = validate_person_id(record.get("person_id"))
    paths.ensure_person_dir(person_id)
    existed = has_consent(person_id)
    if existed and not replace:
        raise RefusalError(
            f"Consent for '{person_id}' is already recorded. Pass --replace to record new consent. The change is logged."
        )
    stored = _copy_authorization(person_id, record)
    path = storage.write_json_private(paths.consent_path(person_id), stored)
    _log(person_id, stored, "replaced" if existed else "recorded")
    return path


def has_consent(person_id: str) -> bool:
    return paths.consent_path(person_id).is_file()


def load_consent(person_id: str) -> Dict[str, Any]:
    return storage.read_json(paths.consent_path(person_id), what="consent")


def require_consent(person_id: str) -> Dict[str, Any]:
    validate_person_id(person_id)
    if not has_consent(person_id):
        raise RefusalError(
            f"No consent is recorded for '{person_id}'. Erase Me only works for you or a family "
            f"member who agrees. Record it first with: consent {person_id} --relationship R --method M"
        )
    record = load_consent(person_id)
    if not isinstance(record, dict) or record.get("person_id") != person_id:
        raise RefusalError(f"The consent file for '{person_id}' does not match this person. Record consent again.")
    return record
