"""Handlers: plan, search-urls, record, draft."""
from __future__ import annotations

import argparse
import datetime as dt
from typing import Any, Dict, List

from . import catalog, clock, consent, custom, deadlines, drafts, jurisdiction, ledger, paths, planner, profile
from .context import Result, person_context
from .ids import validate_item_id
from .output import format_items
from .views import item_view

SKIPPED = "skipped"
NOT_STATUTORY_LABEL = "(suggested follow-up, not a legal deadline)"


def cmd_plan(args: argparse.Namespace) -> Result:
    consent.require_consent(args.person)
    record = profile.load_profile(args.person)
    refs = paths.references_dir()
    planned = planner.plan_items(record, refs, now=clock.now_iso())
    existing = ledger.load_ledger(args.person) if paths.ledger_path(args.person).is_file() else None
    merged = ledger.merge_plan(existing, args.person, planned)
    ledger.save_ledger(merged)
    cat = catalog.load_catalog(refs, record["country"])
    views = [item_view(item, cat, record) for item in merged["items"]]
    added = len(merged["items"]) - len((existing or {}).get("items", []))
    data = {"person_id": args.person, "added": added, "items": views}
    header = f"Plan for {args.person}: {len(views)} items ({added} new). Work through them in this order."
    return Result(data, header + "\n" + format_items(views))


def cmd_add(args: argparse.Namespace) -> Result:
    consent.require_consent(args.person)
    item_id = validate_item_id(args.item)
    record = profile.load_profile(args.person)
    site = custom.build_site(args.name, args.domain, args.email, args.category)
    regime = custom.pick_regime(jurisdiction.load_regimes(paths.references_dir()), record, args.regime)
    item = ledger.new_custom_item(item_id, site, regime, args.evidence or [], now=clock.now_iso())
    existing = ledger.load_ledger(args.person) if paths.ledger_path(args.person).is_file() else None
    updated = ledger.add_item(existing or ledger.new_ledger(args.person, []), item)
    ledger.save_ledger(updated)
    mismatch = custom.email_domain_mismatch(site)
    warnings = [drafts.EMAIL_MISMATCH_WARNING] if mismatch else []
    data = {"item_id": item_id, "status": item["status"], "regime": regime, "site": site,
            "evidence_count": len(item["evidence_urls"]), "email_domain_mismatch": mismatch, "warnings": warnings}
    law = regime or "no law in force, a generic letter will be used"
    count = len(item["evidence_urls"])
    lines = [
        f"Added {item_id} ({site['name']}, {site['domain']}) as {item['status']} with "
        f"{count} evidence URL{'' if count == 1 else 's'}. Law: {law}.",
        *(f"Warning: {w}" for w in warnings),
        f"Next: draft {args.person} {item_id}",
    ]
    return Result(data, "\n".join(lines))


def cmd_search_urls(args: argparse.Namespace) -> Result:
    ctx = person_context(args.person)
    if args.item:
        items = [ledger.find_item(ctx["ledger"], validate_item_id(args.item))]
    else:
        items = [i for i in ctx["ledger"]["items"] if i.get("status") != SKIPPED]
    views = [item_view(item, ctx["catalog"], ctx["profile"]) for item in items]
    data = {"person_id": args.person, "items": views}
    return Result(data, format_items(views) or "No items to search.")


def _rule_for(ctx: Dict[str, Any], item: Dict[str, Any]):
    return (ctx["catalog"]["regimes"].get(item.get("regime")) or {}).get("deadline")


def _due_for(ctx: Dict[str, Any], item: Dict[str, Any], today: dt.date) -> dt.date:
    regime = ctx["catalog"]["regimes"].get(item.get("regime"))
    info = catalog.describe(ctx["catalog"], item)
    fallback = info.get("expected_days") or deadlines.DEFAULT_RESPONSE_DAYS
    return deadlines.compute_due(today, (regime or {}).get("deadline"), fallback_days=fallback)


def cmd_record(args: argparse.Namespace) -> Result:
    ctx = person_context(args.person)
    item_id = validate_item_id(args.item)
    before = ledger.find_item(ctx["ledger"], item_id)
    today = clock.today()
    due = _due_for(ctx, before, today) if args.status == "requested" else None
    updated = ledger.transition(
        ctx["ledger"], item_id, args.status, now=clock.now_iso(), today=today,
        evidence=args.evidence, note=args.note or "", due_on=due,
    )
    ledger.save_ledger(updated)
    after = ledger.find_item(updated, item_id)
    data = {
        "item_id": item_id, "previous_status": before["status"], "status": after["status"],
        "due_on": after.get("due_on"), "evidence_count": len(after["evidence_urls"]),
        "statutory": deadlines.is_statutory(_rule_for(ctx, after)) if after.get("due_on") else None,
    }
    human = f"{item_id}: {before['status']} -> {after['status']}."
    if args.status == "requested" and after.get("due_on"):
        if data["statutory"]:
            human += f" Response due by {after['due_on']}."
        else:
            human += f" Follow up on {after['due_on']} {NOT_STATUTORY_LABEL}."
    return Result(data, human)


def _draft_one(ctx: Dict[str, Any], item: Dict[str, Any], kind: str) -> Dict[str, Any]:
    result = drafts.prepare_draft(
        record=ctx["profile"], consent_record=ctx["consent"], item=item, kind=kind,
        cat=ctx["catalog"], templates_root=ctx["templates"], today=clock.today(),
    )
    path = drafts.save_draft(ctx["person_id"], item["item_id"], kind, result["text"])
    return {
        "kind": kind, "path": str(path), "template_id": result["template_id"], "subject": result["subject"],
        "recipient_name": result["recipient_name"], "recipient_email": result["recipient_email"],
        "missing": result["missing"], "warnings": result["warnings"], "premature": result["premature"],
        "email_domain_mismatch": result["email_domain_mismatch"],
    }


def _draft_human(saved: List[Dict[str, Any]]) -> str:
    lines = []
    for entry in saved:
        lines.append(f"Draft saved: {entry['path']} ({entry['kind']}). It was not sent.")
        if entry["recipient_email"]:
            lines.append(f"    send to: {entry['recipient_email']}")
        if entry["missing"]:
            lines.append(f"    fill in before sending: {', '.join(entry['missing'])}")
        lines.extend(f"    warning: {w}" for w in entry["warnings"])
    lines.append("Review every draft, then send it yourself.")
    return "\n".join(lines)


def cmd_draft(args: argparse.Namespace) -> Result:
    ctx = person_context(args.person)
    item = ledger.find_item(ctx["ledger"], validate_item_id(args.item))
    kinds = [args.kind] + drafts.companion_kinds(ctx["consent"], args.kind)
    saved = [_draft_one(ctx, item, kind) for kind in kinds]
    data = {"item_id": item["item_id"], "sent": False, "drafts": saved}
    return Result(data, _draft_human(saved))

