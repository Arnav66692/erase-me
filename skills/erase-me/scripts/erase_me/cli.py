"""Command line interface. Exit codes: 0 ok, 2 usage error, 3 refusal."""
from __future__ import annotations

import argparse
import sys
from typing import Callable, Dict, List, Optional

from . import __version__
from .commands_review import cmd_deadlines, cmd_report, cmd_stats, cmd_tasks
from .commands_setup import cmd_accounts, cmd_consent, cmd_init, cmd_intake, cmd_laws, cmd_validate
from .commands_work import cmd_add, cmd_draft, cmd_plan, cmd_record, cmd_search_urls
from .consent import METHODS, RELATIONSHIPS
from .context import Result
from .drafts import DRAFT_KINDS
from .errors import EXIT_USAGE, EraseMeError
from .ledger import STATUSES
from .sites import SITE_CATEGORIES
from .output import emit_error, emit_success

PROG = "erase_me.py"
DESCRIPTION = "Erase Me: find and remove your (or a consenting family member's) personal data. Runs locally."


def _json_parent() -> argparse.ArgumentParser:
    parent = argparse.ArgumentParser(add_help=False)
    parent.add_argument("--json", action="store_true", default=argparse.SUPPRESS, help="machine-readable output")
    return parent


def _person(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("person", help="person id, like mom (lowercase letters, digits, hyphens)")


def _add_setup(sub, parent) -> None:
    sub.add_parser("init", parents=[parent], help="create the private home folder")
    consent = sub.add_parser("consent", parents=[parent], help="record consent for a person")
    _person(consent)
    consent.add_argument("--relationship", required=True, help=", ".join(RELATIONSHIPS))
    consent.add_argument("--method", required=True, help=", ".join(METHODS))
    consent.add_argument("--authorization-file", help="path to a signed authorization")
    consent.add_argument("--agent-name", help="name of the family member running Erase Me")
    consent.add_argument("--operator-email", help="email of the family member running Erase Me")
    consent.add_argument("--replace", action="store_true", help="replace existing consent (the change is logged)")
    intake = sub.add_parser("intake", parents=[parent], help="save the person's profile")
    _person(intake)
    intake.add_argument("--name", required=True)
    intake.add_argument("--country", required=True, help="ISO code like US or GB")
    intake.add_argument("--region", help="ISO 3166-2 code like US-CA")
    intake.add_argument("--city", action="append", help="repeat for past cities, current first")
    intake.add_argument("--age-range", help="like 50-59")
    intake.add_argument("--phone", action="append")
    intake.add_argument("--email", action="append")
    intake.add_argument("--variant", action="append", help="other spellings of the name")
    intake.add_argument("--language", default="en")
    laws = sub.add_parser("laws", parents=[parent], help="privacy laws for a person or a country")
    laws.add_argument("person", nargs="?")
    laws.add_argument("--country")
    laws.add_argument("--region")
    accounts = sub.add_parser("accounts", parents=[parent], help="account deletion links")
    accounts.add_argument("--search")
    accounts.add_argument("--limit", type=int, default=25)
    sub.add_parser("validate", parents=[parent], help="check every reference file and template")


def _add_work(sub, parent) -> None:
    _person(sub.add_parser("plan", parents=[parent], help="build the ordered removal plan"))
    add = sub.add_parser("add", parents=[parent], help="add a site found by search that has no reference file")
    _person(add)
    add.add_argument("item", help="new item id, like lista-pessoas")
    add.add_argument("--name", required=True, help="site name as shown on the site")
    add.add_argument("--domain", required=True, help="bare domain, like example.com.br")
    add.add_argument("--email", help="privacy or DPO email for the request")
    add.add_argument("--evidence", action="append", help="listing URL, repeatable. With evidence the item starts as found")
    add.add_argument("--category", help=", ".join(SITE_CATEGORIES))
    add.add_argument("--regime", help="law code. Defaults to the strongest law in force for the person")
    search = sub.add_parser("search-urls", parents=[parent], help="search URLs for the agent to open")
    _person(search)
    search.add_argument("--item")
    record = sub.add_parser("record", parents=[parent], help="update an item's status")
    _person(record)
    record.add_argument("item")
    record.add_argument("status", help=", ".join(STATUSES))
    record.add_argument("--evidence", help="URL of the listing or confirmation")
    record.add_argument("--note", help="stored as plain text")
    draft = sub.add_parser("draft", parents=[parent], help="write a request letter to drafts/ (never sends)")
    _person(draft)
    draft.add_argument("item")
    draft.add_argument("--kind", default="erasure", choices=DRAFT_KINDS)


def _add_review(sub, parent) -> None:
    for name, text in (("deadlines", "requests past their legal deadline"), ("tasks", "everything that needs a human"),
                       ("stats", "counts and removal rate")):
        _person(sub.add_parser(name, parents=[parent], help=text))
    rep = sub.add_parser("report", parents=[parent], help="private HTML report, or the share card with --share")
    _person(rep)
    rep.add_argument("--share", action="store_true", help="write the counts-only share card SVG")
    helper = sub.add_parser("help", parents=[parent], help="show help for a command")
    helper.add_argument("topic", nargs="?")


def build_parser() -> argparse.ArgumentParser:
    parent = _json_parent()
    parser = argparse.ArgumentParser(prog=PROG, description=DESCRIPTION, parents=[parent])
    parser.add_argument("--version", action="version", version=f"erase-me {__version__}")
    sub = parser.add_subparsers(dest="command", metavar="command")
    _add_setup(sub, parent)
    _add_work(sub, parent)
    _add_review(sub, parent)
    return parser


HANDLERS: Dict[str, Callable[[argparse.Namespace], Result]] = {
    "init": cmd_init, "consent": cmd_consent, "intake": cmd_intake, "laws": cmd_laws,
    "accounts": cmd_accounts, "validate": cmd_validate, "plan": cmd_plan, "add": cmd_add, "search-urls": cmd_search_urls,
    "record": cmd_record, "draft": cmd_draft, "deadlines": cmd_deadlines, "tasks": cmd_tasks,
    "stats": cmd_stats, "report": cmd_report,
}


def _help(parser: argparse.ArgumentParser, topic: Optional[str]) -> int:
    if not topic:
        parser.print_help(sys.stdout)
        return 0
    sub_action = next(a for a in parser._actions if isinstance(a, argparse._SubParsersAction))
    if topic not in sub_action.choices:
        sys.stderr.write(f"Error: unknown command '{topic}'.\n")
        return EXIT_USAGE
    sub_action.choices[topic].print_help(sys.stdout)
    return 0


def main(argv: Optional[List[str]] = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    as_json = bool(getattr(args, "json", False))
    if args.command is None:
        parser.print_help(sys.stderr)
        return EXIT_USAGE
    if args.command == "help":
        return _help(parser, args.topic)
    try:
        result = HANDLERS[args.command](args)
    except EraseMeError as exc:
        emit_error(args.command, exc.message, exc.exit_code, as_json)
        return exc.exit_code
    emit_success(args.command, result.data, result.human, as_json)
    return result.code
