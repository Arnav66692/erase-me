"""Shared loading for command handlers. The consent check always runs first."""
from __future__ import annotations

from typing import Any, Dict, NamedTuple

from . import catalog, consent, ledger, paths, profile


class Result(NamedTuple):
    data: Dict[str, Any]
    human: str
    code: int = 0


def person_context(person_id: str, need_ledger: bool = True) -> Dict[str, Any]:
    """Consent first, then profile, ledger and reference catalog."""
    consent_record = consent.require_consent(person_id)
    record = profile.load_profile(person_id)
    refs = paths.references_dir()
    return {
        "person_id": person_id,
        "consent": consent_record,
        "profile": record,
        "ledger": ledger.load_ledger(person_id) if need_ledger else None,
        "references": refs,
        "templates": paths.templates_dir(),
        "catalog": catalog.load_catalog(refs, record["country"]),
    }
