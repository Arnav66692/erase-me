"""Schema rules for jurisdiction, site and account files."""
from __future__ import annotations

import re
from typing import Any, Dict, Optional, Set

from . import schema as s
from .ids import is_valid_item_id
from .sites import ALLOWED_PLACEHOLDERS, PLACEHOLDER_RE, SITE_CATEGORIES

CODE_RE = re.compile(r"[a-z]{2}(-[a-z0-9]+){1,2}")
STATUSES = ("in_force", "not_in_force", "partial")
RIGHTS = ("erasure", "objection", "opt_out_sale", "correction", "access", "delisting")
DAY_TYPES = ("calendar", "business")
BASES = ("one_month", "days")
TEMPLATE_KINDS = ("erasure", "objection", "followup", "complaint", "authorization")
CHANNELS = ("web_form", "email", "postal", "account", "in_app", "legal_request", "search_removal", "drop", "phone")
CATEGORIES = SITE_CATEGORIES
SEARCH_METHODS = ("url_template", "site_search", "search_engine", "manual", "none")
OPTOUT_METHODS = ("web_form", "email", "postal", "account", "in_app", "legal_request", "search_removal", "phone")
REQUIRES = ("email_verification", "captcha", "id_upload", "phone_call", "account", "listing_url", "app_install")
RELIST = ("low", "medium", "high", "unknown")
LICENSES = ("MIT", "official", "own-research")
DIFFICULTY = ("easy", "medium", "hard", "limited", "impossible")
PRIORITY_MIN, PRIORITY_MAX = 1, 3


def _id_field(r: s.FileReport, field: str, value: Any) -> None:
    if not is_valid_item_id(value):
        r.add(field, f"must be lowercase letters, digits and hyphens (max 64), not {value!r}")


def _applies_to(r: s.FileReport, data: Dict[str, Any]) -> None:
    applies = s.obj(r, "applies_to", s.require(r, data, "applies_to"))
    if applies is None:
        return
    countries = applies.get("countries", [])
    regions = applies.get("regions", [])
    s.each(r, "applies_to.countries", countries, lambda f, v: s.country(r, f, v))
    s.each(r, "applies_to.regions", regions, lambda f, v: s.region(r, f, v))
    if not countries and not regions:
        r.add("applies_to", "must list at least one country or region")


def _rights(r: s.FileReport, data: Dict[str, Any]) -> None:
    def check(field: str, entry: Any) -> None:
        if s.obj(r, field, entry) is None:
            return
        s.enum(r, f"{field}.right", entry.get("right"), RIGHTS)
        s.text(r, f"{field}.citation", s.require(r, entry, "citation", f"{field}."))
        s.text(r, f"{field}.summary", s.require(r, entry, "summary", f"{field}."), allow_empty=False)

    s.each(r, "rights", s.require(r, data, "rights"), check)


def _deadline(r: s.FileReport, data: Dict[str, Any]) -> None:
    rule = s.obj(r, "deadline", s.require(r, data, "deadline"))
    if rule is None:
        return
    s.integer(r, "deadline.days", rule.get("days"), 1, nullable=True)
    s.enum(r, "deadline.day_type", rule.get("day_type"), DAY_TYPES)
    s.enum(r, "deadline.basis", rule.get("basis"), BASES)
    s.integer(r, "deadline.extension_days", rule.get("extension_days"), 0, nullable=True)
    s.text(r, "deadline.citation", s.require(r, rule, "citation", "deadline."))


def _regulators(r: s.FileReport, data: Dict[str, Any]) -> None:
    def check(field: str, entry: Any) -> None:
        if s.obj(r, field, entry) is None:
            return
        s.country(r, f"{field}.country", entry.get("country"), allow_star=True)
        s.region(r, f"{field}.region", entry.get("region"), nullable=True)
        s.text(r, f"{field}.name", entry.get("name"), allow_empty=False)
        s.https_url(r, f"{field}.complaint_url", entry.get("complaint_url"), allow_empty=True)

    s.each(r, "regulators", s.require(r, data, "regulators"), check, non_empty=True)


def _templates(r: s.FileReport, data: Dict[str, Any], template_ids: Optional[Set[str]]) -> None:
    mapping = s.obj(r, "templates", s.require(r, data, "templates"))
    for kind, template_id in (mapping or {}).items():
        if kind not in TEMPLATE_KINDS:
            r.add(f"templates.{kind}", f"kind must be one of {', '.join(TEMPLATE_KINDS)}")
        elif template_ids is not None and template_id not in template_ids:
            r.add(f"templates.{kind}", f"no template file templates/requests/{template_id}.md")


def _special_channels(r: s.FileReport, data: Dict[str, Any]) -> None:
    def check(field: str, entry: Any) -> None:
        if s.obj(r, field, entry) is None:
            return
        _id_field(r, f"{field}.id", entry.get("id"))
        s.text(r, f"{field}.name", entry.get("name"), allow_empty=False)
        s.https_url(r, f"{field}.url", entry.get("url"))
        if "channel" in entry:
            s.enum(r, f"{field}.channel", entry.get("channel"), CHANNELS)

    s.each(r, "special_channels", data.get("special_channels", []), check)


def _law_sources(r: s.FileReport, data: Dict[str, Any]) -> None:
    def check(field: str, entry: Any) -> None:
        if s.obj(r, field, entry) is None:
            return
        s.https_url(r, f"{field}.url", entry.get("url"))
        s.text(r, f"{field}.title", entry.get("title", ""))
        s.date(r, f"{field}.accessed_on", entry.get("accessed_on"))

    sources = s.require(r, data, "sources")
    s.each(r, "sources", sources, check)
    s.boolean(r, "verified", data.get("verified"))
    if data.get("verified") is True:
        s.date(r, "verified_on", data.get("verified_on"))
        if not sources:
            r.add("sources", "a verified file must list at least one official source")
    else:
        s.date(r, "verified_on", data.get("verified_on"), nullable=True)


def check_jurisdiction(r: s.FileReport, data: Dict[str, Any], stem: str, template_ids: Optional[Set[str]]) -> None:
    code = s.require(r, data, "code")
    if not isinstance(code, str) or not CODE_RE.fullmatch(code):
        r.add("code", f"must look like us-ca-ccpa or eu-gdpr, not {code!r}")
    elif code != stem:
        r.add("code", f"must match the file name '{stem}'")
    for key in ("name", "short_name"):
        s.text(r, key, s.require(r, data, key), allow_empty=False)
    s.enum(r, "status", s.require(r, data, "status"), STATUSES)
    s.date(r, "in_force_from", data.get("in_force_from"), nullable=True)
    _applies_to(r, data)
    _rights(r, data)
    _deadline(r, data)
    _regulators(r, data)
    s.text(r, "identity_verification", data.get("identity_verification", ""))
    agent = s.obj(r, "authorized_agent", s.require(r, data, "authorized_agent"))
    if agent is not None and agent.get("allowed") is not None:
        s.boolean(r, "authorized_agent.allowed", agent.get("allowed"))
    _templates(r, data, template_ids)
    _special_channels(r, data)
    _law_sources(r, data)


def _search(r: s.FileReport, data: Dict[str, Any]) -> None:
    search = s.obj(r, "search", s.require(r, data, "search"))
    if search is None:
        return
    method = search.get("method")
    s.enum(r, "search.method", method, SEARCH_METHODS)
    template = search.get("url_template") or None
    if template is None:
        if method == "url_template":
            r.add("search.url_template", "is required when search.method is url_template")
    else:
        s.https_url(r, "search.url_template", template)
        unknown = [n for n in PLACEHOLDER_RE.findall(str(template)) if n not in ALLOWED_PLACEHOLDERS]
        if unknown:
            r.add("search.url_template", f"unknown placeholders {', '.join(unknown)}")
    s.each(r, "search.fields", search.get("fields", []), lambda f, v: s.enum(r, f, v, ALLOWED_PLACEHOLDERS))


def _optout(r: s.FileReport, data: Dict[str, Any]) -> None:
    optout = s.obj(r, "optout", s.require(r, data, "optout"))
    if optout is None:
        return
    method = optout.get("method")
    s.enum(r, "optout.method", method, OPTOUT_METHODS)
    s.https_url(r, "optout.url", optout.get("url"), allow_empty=method not in ("web_form", "search_removal"))
    s.email(r, "optout.email", optout.get("email"), nullable=method != "email")
    s.each(r, "optout.requires", optout.get("requires", []), lambda f, v: s.enum(r, f, v, REQUIRES))
    s.each(r, "optout.fields_needed", optout.get("fields_needed", []), lambda f, v: s.text(r, f, v, allow_empty=False))
    s.each(r, "optout.steps", s.require(r, optout, "steps", "optout."),
           lambda f, v: s.text(r, f, v, allow_empty=False), non_empty=True)
    s.integer(r, "optout.expected_days", optout.get("expected_days"), 0, nullable=True)


def _site_sources(r: s.FileReport, data: Dict[str, Any]) -> None:
    def check(field: str, entry: Any) -> None:
        if s.obj(r, field, entry) is None:
            return
        s.https_url(r, f"{field}.url", entry.get("url"))
        s.enum(r, f"{field}.license", entry.get("license"), LICENSES)
        if entry.get("license") == "MIT":
            s.text(r, f"{field}.attribution", entry.get("attribution"), allow_empty=False)

    sources = s.require(r, data, "sources")
    s.each(r, "sources", sources, check)
    s.boolean(r, "verified", data.get("verified"))
    if data.get("verified") is True:
        s.date(r, "last_verified", data.get("last_verified"))
        if not sources:
            r.add("sources", "a verified site must list at least one source")
    else:
        s.date(r, "last_verified", data.get("last_verified"), nullable=True)


def _coverage(r: s.FileReport, data: Dict[str, Any], known_ids: Set[str]) -> None:
    def check(field: str, child: Any) -> None:
        if child == data.get("id"):
            r.add(field, "a site cannot cover itself")
        elif child not in known_ids:
            r.add(field, f"covers unknown site {child!r}")

    s.each(r, "covers", data.get("covers", []), check)


def check_site(r: s.FileReport, data: Dict[str, Any], stem: str, folder_cc: Optional[str], known_ids: Set[str]) -> None:
    site_id = s.require(r, data, "id")
    _id_field(r, "id", site_id)
    if is_valid_item_id(site_id) and site_id != stem:
        r.add("id", f"must match the file name '{stem}'")
    s.text(r, "name", s.require(r, data, "name"), allow_empty=False)
    s.domain(r, "domain", s.require(r, data, "domain"))
    s.enum(r, "category", s.require(r, data, "category"), CATEGORIES)
    countries = s.require(r, data, "countries")
    s.each(r, "countries", countries, lambda f, v: s.country(r, f, v, allow_star=True))
    if folder_cc and isinstance(countries, list) and folder_cc.upper() not in countries:
        r.add("countries", f"must include {folder_cc.upper()} for a site in countries/{folder_cc}/")
    s.integer(r, "priority", s.require(r, data, "priority"), PRIORITY_MIN, PRIORITY_MAX)
    s.optional_text(r, "cluster", data.get("cluster"))
    _coverage(r, data, known_ids)
    _search(r, data)
    _optout(r, data)
    s.enum(r, "relist_risk", data.get("relist_risk", "unknown"), RELIST)
    registries = s.obj(r, "registries", data.get("registries", {}))
    for key, value in (registries or {}).items():
        s.region(r, f"registries.{key}", key)
        s.boolean(r, f"registries.{key}", value)
    _site_sources(r, data)


def check_accounts(r: s.FileReport, data: Dict[str, Any]) -> None:
    s.https_url(r, "source", s.require(r, data, "source"))
    s.text(r, "license", s.require(r, data, "license"), allow_empty=False)
    s.text(r, "attribution", s.require(r, data, "attribution"), allow_empty=False)
    s.date(r, "fetched_on", s.require(r, data, "fetched_on"))

    def check(field: str, entry: Any) -> None:
        if s.obj(r, field, entry) is None:
            return
        s.text(r, f"{field}.name", entry.get("name"), allow_empty=False)
        s.https_url(r, f"{field}.url", entry.get("url"), allow_empty=True)
        s.enum(r, f"{field}.difficulty", entry.get("difficulty"), DIFFICULTY)
        s.each(r, f"{field}.domains", entry.get("domains", []), lambda f, v: s.text(r, f, v))
        s.email(r, f"{field}.email", entry.get("email"))

    s.each(r, "sites", s.require(r, data, "sites"), check)
