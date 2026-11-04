"""Local report (HTML, every value escaped) and the share card (counts only)."""
from __future__ import annotations

import datetime as dt
import html
import re
from pathlib import Path
from typing import Any, Dict, List, Mapping

from . import catalog
from .ledger import STATUSES
from .templates import load_text_template

REPORT_TEMPLATE = "report.html"
SHARE_TEMPLATE = "share-card.svg"
ANY_PLACEHOLDER_RE = re.compile(r"\{\{\s*([a-z_]+)\s*\}\}")
LINK_SCHEMES = ("http://", "https://")
SHARE_COUNTS = ("sites_checked", "found", "requested", "removed", "removal_rate", "days_since_start")
SHARE_LABELS = ("sites_checked_label", "found_label", "requested_label", "removed_label")
SHARE_FIELDS = SHARE_COUNTS + SHARE_LABELS

FALLBACK_REPORT = """<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Erase Me report</title>
<style>body{font-family:system-ui,sans-serif;margin:2rem;}td,th{border-bottom:1px solid #ccc;padding:4px 8px;text-align:left;}</style>
</head><body>
<h1>Erase Me report: {{person_label}}</h1>
<p>Generated on {{generated_on}}. Keep this file private.</p>
<h2>Summary</h2><table>{{summary_rows}}</table>
<h2>Laws</h2><table>{{laws_rows}}</table>
<h2>Items</h2><table>{{item_rows}}</table>
</body></html>
"""

FALLBACK_SHARE = """<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="#101418"/>
<text x="80" y="140" fill="#ffffff" font-family="sans-serif" font-size="64">Erase Me</text>
<text x="80" y="260" fill="#ffffff" font-family="sans-serif" font-size="40">{{sites_checked}} {{sites_checked_label}}</text>
<text x="80" y="320" fill="#ffffff" font-family="sans-serif" font-size="40">{{found}} {{found_label}}</text>
<text x="80" y="380" fill="#ffffff" font-family="sans-serif" font-size="40">{{requested}} {{requested_label}}</text>
<text x="80" y="440" fill="#ffffff" font-family="sans-serif" font-size="40">{{removed}} {{removed_label}} ({{removal_rate}})</text>
<text x="80" y="540" fill="#9aa4ad" font-family="sans-serif" font-size="32">Day {{days_since_start}}</text>
</svg>
"""


def esc(value: Any) -> str:
    return html.escape("" if value is None else str(value), quote=True)


def _substitute(template: str, values: Mapping[str, str]) -> str:
    """Single pass. Unknown placeholders become empty so nothing unexpected leaks."""
    return ANY_PLACEHOLDER_RE.sub(lambda m: values.get(m.group(1), ""), template)


def _header(labels: List[str]) -> str:
    return "<tr>" + "".join(f"<th>{esc(label)}</th>" for label in labels) + "</tr>"


def _link(url: str) -> str:
    if str(url).startswith(LINK_SCHEMES):
        return f'<a href="{esc(url)}" rel="noreferrer noopener">{esc(url)}</a>'
    return esc(url)


def _summary_rows(counts: Dict[str, Any]) -> str:
    labels = (("Sites checked", "sites_checked"), ("Found", "found"), ("Requested", "requested"),
              ("Removed", "removed"), ("Relisted", "relisted"), ("Removal rate", "removal_rate"))
    return "".join(
        f'<tr><th scope="row">{esc(label)}</th><td class="num">{esc(counts.get(key))}</td></tr>'
        for label, key in labels
    )


def _deadline_text(deadline: Dict[str, Any]) -> str:
    if not deadline or deadline.get("days") is None:
        return ""
    return f"{deadline.get('days')} {deadline.get('day_type', '')} days".replace("  ", " ")


def _main_citation(law: Dict[str, Any]) -> str:
    rights = law.get("rights") or []
    erasure = [r for r in rights if r.get("right") == "erasure"]
    chosen = (erasure or rights or [{}])[0]
    return chosen.get("citation") or ""


def _flags(law: Dict[str, Any]) -> str:
    flags = []
    if not law.get("verified"):
        flags.append("unverified")
    if law.get("status") == "not_in_force":
        flags.append("not in force")
    if law.get("status") == "partial":
        flags.append("partly in force")
    if not flags:
        return "verified"
    return " ".join(f'<span class="flag">{esc(f)}</span>' for f in flags)


def _laws_rows(laws: List[Dict[str, Any]]) -> str:
    rows = [_header(["Law", "Right", "Deadline", "Regulator", "Status"])]
    for law in laws:
        regulator = law.get("regulator") or {}
        reg_cell = esc(regulator.get("name"))
        if regulator.get("complaint_url"):
            reg_cell += " " + _link(regulator["complaint_url"])
        cells = [
            esc(law.get("short_name") or law.get("name")), esc(_main_citation(law)),
            esc(_deadline_text(law.get("deadline") or {})), reg_cell, _flags(law),
        ]
        rows.append("<tr>" + "".join(f"<td>{c}</td>" for c in cells) + "</tr>")
    return "".join(rows)


def _item_row(item: Dict[str, Any], info: Dict[str, Any]) -> str:
    status = item.get("status") if item.get("status") in STATUSES else "unknown"
    notes = [h.get("note") for h in item.get("history", []) if h.get("note")]
    when = item.get("removed_on") or item.get("due_on") or item.get("requested_on") or ""
    links = "<br>".join(_link(u) for u in item.get("evidence_urls", []))
    return (
        f'<tr data-status="{esc(status)}"><td>{esc(info.get("name"))}</td><td>{esc(item.get("channel"))}</td>'
        f'<td><span class="status status-{esc(status)}">{esc(status)}</span></td>'
        f'<td class="date">{esc(when)}</td><td class="url">{links}</td>'
        f'<td class="note untrusted">{esc(notes[-1] if notes else "")}</td></tr>'
    )


def _item_rows(ledger: Dict[str, Any], cat: Dict[str, Any]) -> str:
    rows = [_header(["Site", "Channel", "Status", "Date", "Evidence", "Last note (untrusted text)"])]
    rows += [_item_row(item, catalog.describe(cat, item)) for item in ledger.get("items", [])]
    return "".join(rows)


def build_report_html(record, ledger, cat, laws, counts, today: dt.date, templates_root: Path) -> str:
    template = load_text_template(templates_root, REPORT_TEMPLATE, FALLBACK_REPORT)
    return _substitute(template, {
        "generated_on": esc(today.isoformat()),
        "person_label": esc(record.get("full_name")),
        "summary_rows": _summary_rows(counts),
        "laws_rows": _laws_rows(laws),
        "item_rows": _item_rows(ledger, cat),
    })


ZERO_RATE = "0%"


def share_values(counts: Dict[str, Any]) -> Dict[str, str]:
    """Counts only. The rate doubles as an SVG bar width, so it is always a percent."""
    values = {key: esc(counts.get(key, "")) for key in SHARE_FIELDS}
    if counts.get("removal_rate_value") is None:
        values["removal_rate"] = ZERO_RATE
    return values


def build_share_svg(counts: Dict[str, Any], templates_root: Path) -> str:
    template = load_text_template(templates_root, SHARE_TEMPLATE, FALLBACK_SHARE)
    return _substitute(template, share_values(counts))
