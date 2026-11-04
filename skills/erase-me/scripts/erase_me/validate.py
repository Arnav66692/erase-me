"""The validate command: schema checks for every reference file and template."""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

from . import schema as s
from . import validate_refs as rules
from .errors import UsageError
from .report import SHARE_FIELDS
from .templates import DISCLAIMER, REQUEST_PLACEHOLDERS, parse_template, placeholders

COUNTRY_DIR_RE = re.compile(r"[a-z]{2}")
ANY_REGIME = ("any", "*")
REPORT_FIELDS = ("generated_on", "person_label", "summary_rows", "laws_rows", "item_rows")
ACCOUNTS_NAME = "jdm.json"

Loaded = Tuple[str, Path, Optional[Dict[str, Any]]]


def _rel(path: Path, root: Path) -> str:
    return path.relative_to(root).as_posix()


def _load(path: Path, root: Path, errors: List[str]) -> Optional[Dict[str, Any]]:
    rel = _rel(path, root)
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (ValueError, UnicodeDecodeError) as exc:
        errors.append(f"{rel}: not valid UTF-8 JSON ({exc})")
        return None
    if not isinstance(data, dict):
        errors.append(f"{rel}: must contain a JSON object")
        return None
    return data


def _classify(path: Path, refs: Path) -> Tuple[str, Optional[str]]:
    parts = path.relative_to(refs).parts
    if len(parts) == 2 and parts[0] in ("jurisdictions", "global"):
        return parts[0], None
    if len(parts) == 3 and parts[0] == "countries":
        return ("country", parts[1]) if COUNTRY_DIR_RE.fullmatch(parts[1]) else ("bad_country", parts[1])
    if parts == ("accounts", ACCOUNTS_NAME):
        return "accounts", None
    return "unexpected", None


def _template_ids(skill: Path) -> Optional[Set[str]]:
    folder = skill / "templates" / "requests"
    return {p.stem for p in folder.glob("*.md")} if folder.is_dir() else None


def _check_reference(kind, folder_cc, path, data, skill, template_ids, site_ids) -> List[str]:
    report = s.FileReport(_rel(path, skill))
    if kind == "jurisdictions":
        rules.check_jurisdiction(report, data, path.stem, template_ids)
    elif kind in ("global", "country"):
        rules.check_site(report, data, path.stem, folder_cc, site_ids)
    elif kind == "accounts":
        rules.check_accounts(report, data)
    return report.errors


def validate_references(skill: Path) -> List[str]:
    refs = skill / "references"
    if not refs.is_dir():
        return [f"references: folder is missing at {refs}"]
    errors: List[str] = []
    loaded = []
    for path in sorted(refs.rglob("*.json")):
        kind, folder_cc = _classify(path, refs)
        if kind == "unexpected":
            errors.append(f"{_rel(path, skill)}: unexpected JSON file. Use jurisdictions/, global/, countries/<cc>/ or accounts/jdm.json")
            continue
        if kind == "bad_country":
            errors.append(f"{_rel(path.parent, skill)}: country folders must be lowercase two-letter codes")
            continue
        data = _load(path, skill, errors)
        if data is not None:
            loaded.append((kind, folder_cc, path, data))
    site_ids = {str(d.get("id")) for k, _, _, d in loaded if k in ("global", "country")}
    template_ids = _template_ids(skill)
    for kind, folder_cc, path, data in loaded:
        errors.extend(_check_reference(kind, folder_cc, path, data, skill, template_ids, site_ids))
    return errors


def _check_request_template(path: Path, skill: Path) -> List[str]:
    report = s.FileReport(_rel(path, skill))
    try:
        parsed = parse_template(path.read_text(encoding="utf-8"))
    except (UsageError, UnicodeDecodeError) as exc:
        report.add("", f"cannot parse template ({exc})")
        return report.errors
    meta = parsed["meta"]
    for key in ("id", "kind", "regimes", "subject"):
        if not meta.get(key):
            report.add(key, "is required in the frontmatter")
    if meta.get("id") and meta["id"] != path.stem:
        report.add("id", f"must match the file name '{path.stem}'")
    if meta.get("kind"):
        s.enum(report, "kind", meta["kind"], rules.TEMPLATE_KINDS)
    for regime in meta.get("regimes") or []:
        if regime not in ANY_REGIME and not rules.CODE_RE.fullmatch(regime):
            report.add("regimes", f"{regime!r} is not a regime code or 'any'")
    used = placeholders(str(meta.get("subject", "")) + "\n" + parsed["body"])
    for name in used:
        if name not in REQUEST_PLACEHOLDERS:
            report.add("placeholders", f"unknown placeholder {{{{{name}}}}}")
    lines = [line.strip() for line in parsed["body"].splitlines() if line.strip()]
    if not lines or lines[-1] != DISCLAIMER:
        report.add("body", f"must end with the disclaimer line: {DISCLAIMER}")
    return report.errors


def _check_fixed_template(path: Path, skill: Path, allowed: tuple, required: tuple) -> List[str]:
    report = s.FileReport(_rel(path, skill))
    used = placeholders(path.read_text(encoding="utf-8"))
    for name in used:
        if name not in allowed:
            report.add("placeholders", f"{{{{{name}}}}} is not allowed here. Allowed: {', '.join(allowed)}")
    for name in required:
        if name not in used:
            report.add("placeholders", f"{{{{{name}}}}} is missing")
    return report.errors


def validate_templates(skill: Path) -> List[str]:
    root = skill / "templates"
    if not root.is_dir():
        return []
    errors: List[str] = []
    for path in sorted((root / "requests").glob("*.md")):
        errors.extend(_check_request_template(path, skill))
    report_html = root / "report.html"
    if report_html.is_file():
        errors.extend(_check_fixed_template(report_html, skill, REPORT_FIELDS, REPORT_FIELDS))
    share = root / "share-card.svg"
    if share.is_file():
        errors.extend(_check_fixed_template(share, skill, SHARE_FIELDS, ()))
    return errors


def validate_skill(skill: Path) -> List[str]:
    return validate_references(skill) + validate_templates(skill)
