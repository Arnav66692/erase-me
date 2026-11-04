"""Handlers: deadlines, tasks, report, stats."""
from __future__ import annotations

import argparse

from . import catalog, clock, deadlines, jurisdiction, paths, report, stats, storage, tasks
from .context import Result, person_context
from .commands_work import NOT_STATUTORY_LABEL
from .output import bullet_list


def cmd_deadlines(args: argparse.Namespace) -> Result:
    ctx = person_context(args.person)
    rows = deadlines.overdue(ctx["ledger"], ctx["catalog"]["regimes"], clock.today())
    enriched = []
    for row in rows:
        item = next(i for i in ctx["ledger"]["items"] if i["item_id"] == row["item_id"])
        name = catalog.describe(ctx["catalog"], item)["name"]
        command = f"draft {args.person} {row['item_id']} --kind {row['next_kind']}"
        enriched.append(dict(row, name=name, next_command=command))
    data = {"person_id": args.person, "today": clock.today().isoformat(), "overdue": enriched}
    if not enriched:
        return Result(data, "Nothing is overdue.")
    lines = []
    for r in enriched:
        label = "due" if r["statutory"] else f"follow-up date {NOT_STATUTORY_LABEL}"
        lines.append(
            f"{r['name']} [{r['item_id']}]: {label} {r['due_on']}, {r['days_overdue']} days ago. Next: {r['next_command']}"
        )
    return Result(data, "\n".join(lines))


UPCOMING_HEADING = "Coming up (steps for sites not checked yet, if a listing is found)"


def _group_lines(groups, indent: str = "") -> list:
    lines = []
    for group in groups:
        lines.append(f"{indent}{group['label']} ({len(group['items'])})")
        for entry in group["items"]:
            target = entry["optout_url"] or ""
            lines.append(f"{indent}  - {entry['name']} [{entry['item_id']}] {target}".rstrip())
            if entry["reason"]:
                lines.extend(bullet_list([entry["reason"]], indent=indent + "    "))
    return lines


def cmd_tasks(args: argparse.Namespace) -> Result:
    ctx = person_context(args.person)
    result = tasks.digest(ctx["ledger"], ctx["catalog"])
    data = dict(result, person_id=args.person)
    lines = _group_lines(result["groups"]) if result["groups"] else ["Nothing needs you right now."]
    if result["upcoming"]:
        lines += ["", UPCOMING_HEADING] + _group_lines(result["upcoming"], indent="  ")
    return Result(data, "\n".join(lines))


def cmd_stats(args: argparse.Namespace) -> Result:
    ctx = person_context(args.person, need_ledger=True)
    counts = stats.compute(ctx["ledger"], clock.today())
    human = "\n".join([
        f"{counts['sites_checked']} {counts['sites_checked_label']}",
        f"{counts['found']} {counts['found_label']}",
        f"{counts['requested']} {counts['requested_label']}",
        f"{counts['removed']} {counts['removed_label']}",
        f"{counts['relisted']} relisted",
        f"Removal rate: {counts['removal_rate']}",
    ])
    return Result(dict(counts, person_id=args.person), human)


def _share(args: argparse.Namespace, ctx, counts) -> Result:
    svg = report.build_share_svg(counts, ctx["templates"])
    paths.ensure_share_dir()
    path = storage.write_text_private(paths.share_card_path(args.person), svg)
    data = {"path": str(path), "counts": report.share_values(counts)}
    return Result(data, f"Share card saved to {path}. It holds counts only.")


def cmd_report(args: argparse.Namespace) -> Result:
    ctx = person_context(args.person)
    today = clock.today()
    counts = stats.compute(ctx["ledger"], today)
    if args.share:
        return _share(args, ctx, counts)
    record = ctx["profile"]
    regimes = jurisdiction.match_regimes(
        list(ctx["catalog"]["regimes"].values()), record["country"], record.get("region")
    )
    laws = [jurisdiction.summarize(r, record["country"], record.get("region")) for r in regimes]
    html = report.build_report_html(record, ctx["ledger"], ctx["catalog"], laws, counts, today, ctx["templates"])
    path = storage.write_text_private(paths.report_path(args.person), html)
    return Result({"path": str(path)}, f"Report saved to {path}. Keep it private.")
