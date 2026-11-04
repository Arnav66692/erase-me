"""Fills request letters into the drafts folder. It never sends anything."""
from __future__ import annotations

import datetime as dt
from pathlib import Path
from typing import Any, Dict, List, Optional

from . import catalog, custom, jurisdiction, paths, storage, templates
from .errors import RefusalError, UsageError
from .letter_values import NO_FIXED_DATE_TEXT, NO_FIXED_DAYS_TEXT, build_values, dedupe_law  # noqa: F401

DRAFT_KINDS = ("erasure", "objection", "followup", "complaint", "authorization")
FALLBACK_TEMPLATES = {
    "erasure": "generic-erasure",
    "objection": "generic-erasure",
    "followup": "followup-generic",
    "complaint": "regulator-complaint-generic",
    "authorization": "authorized-agent-cover",
}
REQUEST_KINDS_WITH_COVER = ("erasure", "objection")
AFTER_DEADLINE_KINDS = ("followup", "complaint")
SIGNED = "signed_authorization"
LEGAL_ROUTE = "legal_route"
NO_AGENT_RULE_WARNING = (
    "This law has no confirmed authorized agent rule. The person may need to send the request themselves."
)
NO_REGIME_WARNING = "No privacy law matched this item. The letter relies on the site's own policy."
FAMILY_SEND_WARNING = "Your family member must send this from their own email or sign it themselves."
EMAIL_MISMATCH_WARNING = (
    "The recipient email domain does not match the site's domain. Check it on the site before sending."
)
NOT_REQUESTED_WARNING = "This item has not been requested yet, so a follow-up or complaint is premature."


def _check_kind(kind: str) -> str:
    if kind not in DRAFT_KINDS:
        raise UsageError(f"Unknown draft kind '{kind}'. Use one of: {', '.join(DRAFT_KINDS)}.")
    return kind


def choose_template_id(regime: Optional[Dict[str, Any]], kind: str) -> str:
    mapped = ((regime or {}).get("templates") or {}).get(kind)
    return mapped or FALLBACK_TEMPLATES[kind]


def is_self(consent_record: Dict[str, Any]) -> bool:
    return consent_record.get("relationship") == "self"


def has_signed_authorization(consent_record: Dict[str, Any]) -> bool:
    return not is_self(consent_record) and consent_record.get("method") == SIGNED


def companion_kinds(consent_record: Dict[str, Any], kind: str) -> List[str]:
    """Only a signed authorization lets a family member act as agent, so only then is a cover letter added."""
    if not has_signed_authorization(consent_record) or kind not in REQUEST_KINDS_WITH_COVER:
        return []
    return ["authorization"]


def _regime_for(item: Dict[str, Any], cat: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    regime = cat["regimes"].get(item.get("regime"))
    if regime and not jurisdiction.usable_for_requests(regime):
        raise RefusalError(
            f"{regime.get('name')} is not in force yet, so Erase Me will not draft a legal request under it. "
            "Use the site's own opt-out instead."
        )
    return regime


def _premature(item: Dict[str, Any], kind: str, today: dt.date) -> Optional[str]:
    """A warning when a follow-up or complaint would go out before the response was due."""
    if kind not in AFTER_DEADLINE_KINDS:
        return None
    due = item.get("due_on")
    if not due:
        return NOT_REQUESTED_WARNING
    if today <= dt.date.fromisoformat(due):
        return f"The response is not due until {due}. Wait until after that date before sending this."
    return None


def _warnings(regime, kind: str, consent_record, item, today: dt.date, mismatch: bool) -> List[str]:
    warnings = jurisdiction.regime_warnings(regime) if regime else [NO_REGIME_WARNING]
    if kind == "authorization" and not (regime or {}).get("authorized_agent", {}).get("allowed"):
        warnings.append(NO_AGENT_RULE_WARNING)
    if not is_self(consent_record) and not has_signed_authorization(consent_record):
        warnings.append(FAMILY_SEND_WARNING)
    if mismatch:
        warnings.append(EMAIL_MISMATCH_WARNING)
    premature = _premature(item, kind, today)
    return warnings + ([premature] if premature else [])


def _guard(record, consent_record, item, kind: str, info: Dict[str, Any]) -> None:
    if kind == "authorization" and not has_signed_authorization(consent_record):
        raise RefusalError(
            "An authorized agent cover letter needs a signed authorization. Record it with consent "
            "--method signed_authorization --authorization-file F --replace, or let your family member send the request."
        )
    if info.get("category") == LEGAL_ROUTE and item.get("source") != "custom":
        raise RefusalError(
            f"{info.get('name')} is a legal request route, not a site that holds the data. Find the site that shows "
            f"the listing, add it with: add {record['person_id']} SITE-ID --name NAME --domain DOMAIN --email EMAIL, "
            "then draft to that item."
        )


def _load_template(templates_root: Path, template_id: str, kind: str) -> Dict[str, Any]:
    if not templates.request_template_path(templates_root, template_id).is_file():
        raise UsageError(
            f"No request template '{template_id}' for the {kind} letter. Add templates/requests/{template_id}.md."
        )
    return templates.load_request_template(templates_root, template_id)


def prepare_draft(*, record, consent_record, item, kind, cat, templates_root: Path, today: dt.date) -> Dict[str, Any]:
    _check_kind(kind)
    info = catalog.describe(cat, item)
    _guard(record, consent_record, item, kind, info)
    regime = _regime_for(item, cat)
    regulator = jurisdiction.pick_regulator(regime, record["country"], record.get("region")) if regime else None
    if kind == "complaint" and not regulator:
        raise RefusalError("No regulator is known for this item, so a complaint cannot be drafted.")
    template_id = choose_template_id(regime, kind)
    template = _load_template(templates_root, template_id, kind)
    values = build_values(record, consent_record, item, info, regime, regulator, today, kind=kind)
    subject, missing_subject = templates.fill(template["meta"].get("subject", ""), values)
    body, missing_body = templates.fill(template["body"].lstrip("\n"), values)
    short = (regime or {}).get("short_name")
    mismatch = custom.email_domain_mismatch(item.get("site")) if item.get("source") == "custom" else False
    warnings = _warnings(regime, kind, consent_record, item, today, mismatch)
    return {
        "template_id": template_id,
        "kind": kind,
        "subject": dedupe_law(subject, short),
        "text": dedupe_law(f"Subject: {subject}\n\n{body}", short),
        "missing": list(dict.fromkeys(missing_subject + missing_body)),
        "recipient_name": info.get("name"),
        "recipient_email": info.get("email"),
        "sent": False,
        "premature": _premature(item, kind, today) is not None,
        "email_domain_mismatch": mismatch,
        "warnings": warnings,
    }


def save_draft(person_id: str, item_id: str, kind: str, text: str) -> Path:
    paths.ensure_person_dir(person_id)
    return storage.write_text_private(paths.draft_path(person_id, item_id, _check_kind(kind)), text)
