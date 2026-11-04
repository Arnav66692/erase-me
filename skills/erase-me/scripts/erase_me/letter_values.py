"""The values a request letter is filled with. Law wording, deadlines and the people involved."""
from __future__ import annotations

import datetime as dt
import re
from typing import Any, Dict, Optional

from . import deadlines, jurisdiction, profile

NO_FIXED_DAYS_TEXT = "a reasonable time"
NO_FIXED_DATE_TEXT = "as soon as reasonably practicable"
NO_LAW_SENTENCE = (
    "No specific privacy law is cited. This request relies on your own privacy policy and good data protection practice."
)
NO_LAW_BASIS = "your privacy policy"
NO_REGULATOR_ESCALATION = "If you do not, I will consider the other steps open to me."
BARE_CITATION_RE = re.compile(r"(Art\.?|Article|s\.|ss\.|Sec\.|Section|Sch\.?|§|cl\.|r\.|reg\.|Rule|para\.?)\s", re.IGNORECASE)
MIN_TOKEN_MATCH = 3
RELATIONSHIP_WORDS = {
    "self": "self", "parent": "parent", "spouse": "spouse", "sibling": "sibling", "child": "child",
    "grandparent": "grandparent", "other_family": "family member",
}
CITATION_KEYS = ("citation_erasure", "citation_objection", "citation_deadline", "citation_agent")


def relationship_word(relationship: Optional[str]) -> Optional[str]:
    if relationship is None:
        return None
    return RELATIONSHIP_WORDS.get(relationship, relationship.replace("_", " "))


def law_ref(short: Optional[str], citation: Optional[str]) -> Optional[str]:
    """A citation that names its law exactly once, like 'GDPR Art. 17' or 'Cal. Civ. Code 1798.99.86 (CCPA)'."""
    if not citation:
        return None
    if not short:
        return citation
    first = short.split()[0]
    if citation.startswith(short) or (len(first) >= MIN_TOKEN_MATCH and citation.startswith(first)):
        return citation
    if BARE_CITATION_RE.match(citation):
        return f"{short} {citation}"
    return f"{citation} ({short})"


def dedupe_law(text: str, short: Optional[str]) -> str:
    """Collapse 'UK GDPR UK GDPR Art. 17' (a short name written twice in a row) into one."""
    if not short:
        return text
    name = re.escape(short)
    return re.sub(rf"\b{name}(?:\s+{name}\b)+", short, text)


def clean_law_name(name: Optional[str]) -> Optional[str]:
    if not name:
        return None
    return name.strip().rstrip(".").strip() or None


def _law_sentence(short: Optional[str], citation: Optional[str]) -> str:
    if not short:
        return NO_LAW_SENTENCE
    if not citation:
        return f"Where the {short} applies, this request is made under it."
    return f"Where the {short} applies, this request is made under {citation}."


def law_values(regime: Optional[Dict[str, Any]], regulator: Optional[Dict[str, Any]]) -> Dict[str, Optional[str]]:
    regime = regime or {}
    short = regime.get("short_name")
    agent = regime.get("authorized_agent") or {}
    citations = {
        "citation_erasure": law_ref(short, jurisdiction.right_citation(regime, "erasure")),
        "citation_objection": law_ref(short, jurisdiction.right_citation(regime, "objection")),
        "citation_agent": law_ref(short, agent.get("citation") or None),
    }
    name, url = (regulator or {}).get("name"), (regulator or {}).get("complaint_url")
    escalation = NO_REGULATOR_ESCALATION
    if name:
        escalation = f"If you do not, I will file a complaint with the {name}" + (f" at {url}." if url else ".")
    return dict(
        citations,
        law_name=clean_law_name(regime.get("name")),
        law_short=short,
        law_basis=f"the {short}" if short else NO_LAW_BASIS,
        law_sentence=_law_sentence(short, citations["citation_erasure"]),
        regulator_name=name,
        regulator_url=url,
        escalation_sentence=escalation,
    )


def _period(rule: Dict[str, Any], days: int) -> str:
    if rule.get("basis") == deadlines.BASIS_ONE_MONTH:
        return "within one month"
    if rule.get("day_type") == deadlines.BUSINESS:
        return f"within {days} business days"
    return f"within {days} days"


def _asked(kind: str, recipient: Optional[str], due: str) -> str:
    """Past wording for a date the law does not fix. It reports what was asked, not a legal due date."""
    if kind == "complaint":
        return f"I asked {recipient or 'the organization'} for a reply by {due}."
    return f"I asked for a reply by {due}."


def _sentences(kind: str, recipient: Optional[str], citation: Optional[str], period: Optional[str], due: str):
    lead = f"Under {citation}, " if citation else ""
    who = f"the response from {recipient or 'the organization'}" if kind == "complaint" else "your response"
    if period is None:
        present = f"Please respond {NO_FIXED_DATE_TEXT}, and in any case by {due}."
        return {"deadline_sentence": present, "deadline_sentence_past": _asked(kind, recipient, due)}
    must = "you must respond" if citation else "please respond"
    present = f"{lead}{must} {period}, by {due}."
    past = f"{lead}{who} was due by {due}." if citation else _asked(kind, recipient, due)
    return {"deadline_sentence": present[0].upper() + present[1:], "deadline_sentence_past": past[0].upper() + past[1:]}


def deadline_values(item, regime, info, today: dt.date, kind: str, recipient: Optional[str]) -> Dict[str, Optional[str]]:
    rule = (regime or {}).get("deadline") or {}
    citation = law_ref((regime or {}).get("short_name"), rule.get("citation"))
    start = dt.date.fromisoformat(item["requested_on"]) if item.get("requested_on") else today
    if regime and not deadlines.is_statutory(rule):
        due = item.get("due_on") or (start + dt.timedelta(days=deadlines.NO_FIXED_DEADLINE_FOLLOWUP_DAYS)).isoformat()
        values = {"deadline_days": NO_FIXED_DAYS_TEXT, "deadline_date": NO_FIXED_DATE_TEXT, "citation_deadline": citation}
        values.update(_sentences(kind, recipient, citation, None, due))
        return values
    fallback = info.get("expected_days") or deadlines.DEFAULT_RESPONSE_DAYS
    due = item.get("due_on") or deadlines.compute_due(start, rule, fallback_days=fallback).isoformat()
    days = rule.get("days") or fallback
    values = {"deadline_days": str(days), "deadline_date": due, "citation_deadline": citation}
    values.update(_sentences(kind, recipient, citation if regime else None, _period(rule, days), due))
    return values


def address_line(record: Dict[str, Any]) -> Optional[str]:
    city = profile.current_city(record)
    if not city:
        return None
    return ", ".join(p for p in (city.get("city"), city.get("region"), city.get("country")) if p)


def agent_values(record: Dict[str, Any], consent_record: Dict[str, Any]) -> Dict[str, Optional[str]]:
    emails = record.get("emails") or []
    if consent_record.get("relationship") == "self":
        return {"agent_name": record.get("full_name"), "agent_relationship": "self",
                "operator_email": emails[0] if emails else None}
    return {
        "agent_name": consent_record.get("agent_name"),
        "agent_relationship": relationship_word(consent_record.get("relationship")),
        "operator_email": consent_record.get("operator_email"),
    }


def original_request_date(item: Dict[str, Any]) -> Optional[str]:
    return item.get("first_requested_on") or item.get("requested_on")


def build_values(record, consent_record, item, info, regime, regulator, today: dt.date, kind: str = "erasure"):
    emails = record.get("emails") or []
    urls = item.get("evidence_urls") or []
    first = original_request_date(item)
    values = {
        "full_name": record.get("full_name"),
        "email": emails[0] if emails else None,
        "address_line": address_line(record),
        "today": today.isoformat(),
        "recipient_name": info.get("name"),
        "recipient_email": info.get("email"),
        "listing_urls": "\n".join(f"- {u}" for u in urls) or None,
        "original_request_date": first,
        "reference": f"ERASE-ME-{item['item_id'].upper()}-{(first or today.isoformat()).replace('-', '')}",
    }
    values.update(agent_values(record, consent_record))
    values.update(law_values(regime, regulator))
    values.update(deadline_values(item, regime, info, today, kind, info.get("name")))
    return values
