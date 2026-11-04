from __future__ import annotations

import json

import pytest

from erase_me import validate


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def save(path, data):
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")


def mutate(path, change):
    data = load(path)
    change(data)
    save(path, data)


def errors_for(skill_dir, needle):
    return [e for e in validate.validate_skill(skill_dir) if needle in e]


def test_fixture_skill_is_clean(skill_dir):
    assert validate.validate_skill(skill_dir) == []


def test_missing_references_dir(tmp_path):
    errors = validate.validate_skill(tmp_path)
    assert any("references" in e for e in errors)


def test_invalid_json_reported_with_path(skill_dir):
    (skill_dir / "references" / "global" / "broken.json").write_text("{nope", encoding="utf-8")
    errors = validate.validate_skill(skill_dir)
    assert any(e.startswith("references/global/broken.json:") and "JSON" in e for e in errors)


def test_top_level_must_be_object(skill_dir):
    (skill_dir / "references" / "global" / "list.json").write_text("[]", encoding="utf-8")
    assert errors_for(skill_dir, "references/global/list.json")


JUR = "references/jurisdictions/zz-tpa.json"


@pytest.mark.parametrize(
    "change, needle",
    [
        (lambda d: d.pop("name"), "name: is required"),
        (lambda d: d.update(code="ZZ-TPA"), "code"),
        (lambda d: d.update(code="zz-other"), "file name"),
        (lambda d: d.update(status="maybe"), "status"),
        (lambda d: d.update(in_force_from="2020/01/01"), "in_force_from"),
        (lambda d: d["applies_to"].update(countries=["zz"]), "applies_to.countries[0]"),
        (lambda d: d["applies_to"].update(regions=["ZZTV"]), "applies_to.regions[0]"),
        (lambda d: d["applies_to"].update(countries=[], regions=[]), "applies_to"),
        (lambda d: d["rights"][0].update(right="flying"), "rights[0].right"),
        (lambda d: d["rights"][0].update(summary=""), "rights[0].summary"),
        (lambda d: d["deadline"].update(days=0), "deadline.days"),
        (lambda d: d["deadline"].update(day_type="lunar"), "deadline.day_type"),
        (lambda d: d["deadline"].update(basis="weeks"), "deadline.basis"),
        (lambda d: d["deadline"].update(extension_days=-1), "deadline.extension_days"),
        (lambda d: d.update(regulators=[]), "regulators"),
        (lambda d: d["regulators"][0].update(complaint_url="http://tdo.example.org"), "regulators[0].complaint_url"),
        (lambda d: d["regulators"][0].update(country="Testland"), "regulators[0].country"),
        (lambda d: d["templates"].update(erasure="missing-template"), "templates.erasure"),
        (lambda d: d["templates"].update(poem="tpa-erasure"), "templates.poem"),
        (lambda d: d["special_channels"][0].update(url="ftp://drop.example.org"), "special_channels[0].url"),
        (lambda d: d["special_channels"][0].update(id="Bad Id"), "special_channels[0].id"),
        (lambda d: d["special_channels"][0].update(channel="pigeon"), "special_channels[0].channel"),
        (lambda d: d.update(sources=[]), "sources"),
        (lambda d: d["sources"][0].update(accessed_on="yesterday"), "sources[0].accessed_on"),
        (lambda d: d.update(verified_on=None), "verified_on"),
        (lambda d: d.update(verified="yes"), "verified"),
        (lambda d: d["authorized_agent"].update(allowed="sure"), "authorized_agent.allowed"),
    ],
)
def test_jurisdiction_errors(skill_dir, change, needle):
    mutate(skill_dir / JUR, change)
    errors = errors_for(skill_dir, JUR)
    assert any(needle in e for e in errors), errors


SITE = "references/countries/zz/peoplefind.json"


@pytest.mark.parametrize(
    "change, needle",
    [
        (lambda d: d.pop("optout"), "optout: is required"),
        (lambda d: d.update(id="other"), "file name"),
        (lambda d: d.update(domain="https://peoplefind.example.com"), "domain"),
        (lambda d: d.update(category="gossip"), "category"),
        (lambda d: d.update(countries=["GB"]), "countries"),
        (lambda d: d.update(priority=4), "priority"),
        (lambda d: d.update(covers=["peoplefind"]), "covers"),
        (lambda d: d.update(covers=["ghost-site"]), "covers"),
        (lambda d: d["search"].update(method="crystal"), "search.method"),
        (lambda d: d["search"].update(url_template="http://peoplefind.example.com/{first}"), "search.url_template"),
        (lambda d: d["search"].update(url_template="https://peoplefind.example.com/{ssn}"), "search.url_template"),
        (lambda d: d["search"].update(url_template=None), "search.url_template"),
        (lambda d: d["search"].update(fields=["ssn"]), "search.fields[0]"),
        (lambda d: d["optout"].update(method="fax"), "optout.method"),
        (lambda d: d["optout"].update(url=""), "optout.url"),
        (lambda d: d["optout"].update(requires=["blood"]), "optout.requires[0]"),
        (lambda d: d["optout"].update(steps=[]), "optout.steps"),
        (lambda d: d["optout"].update(expected_days="soon"), "optout.expected_days"),
        (lambda d: d["optout"].update(email="nope"), "optout.email"),
        (lambda d: d.update(relist_risk="extreme"), "relist_risk"),
        (lambda d: d.update(registries={"zz": True}), "registries"),
        (lambda d: d["sources"][0].update(license="GPL"), "sources[0].license"),
        (lambda d: d["sources"][0].update(license="MIT", attribution=""), "sources[0].attribution"),
        (lambda d: d.update(last_verified=None), "last_verified"),
        (lambda d: d.update(sources=[]), "sources"),
    ],
)
def test_site_errors(skill_dir, change, needle):
    mutate(skill_dir / SITE, change)
    errors = errors_for(skill_dir, SITE)
    assert any(needle in e for e in errors), errors


def test_email_method_needs_email(skill_dir):
    mutate(skill_dir / "references/countries/zz/oldbook.json", lambda d: d["optout"].update(email=None))
    assert errors_for(skill_dir, "optout.email")


def test_unverified_site_may_skip_dates(skill_dir):
    assert errors_for(skill_dir, "example-callerid") == []


def test_bad_country_folder(skill_dir):
    folder = skill_dir / "references" / "countries" / "ZZZ"
    folder.mkdir()
    (folder / "x.json").write_text("{}")
    assert errors_for(skill_dir, "references/countries/ZZZ")


def test_unexpected_json_location(skill_dir):
    (skill_dir / "references" / "stray.json").write_text("{}")
    assert errors_for(skill_dir, "references/stray.json")


ACC = "references/accounts/jdm.json"


@pytest.mark.parametrize(
    "change, needle",
    [
        (lambda d: d.update(source="http://github.com/jdm-contrib/jdm"), "source"),
        (lambda d: d.update(attribution=""), "attribution"),
        (lambda d: d.update(fetched_on="today"), "fetched_on"),
        (lambda d: d["sites"][0].update(url="http://social.example.com"), "sites[0].url"),
        (lambda d: d["sites"][0].update(difficulty="trivial"), "sites[0].difficulty"),
        (lambda d: d["sites"][0].update(name=""), "sites[0].name"),
        (lambda d: d.update(sites={}), "sites"),
    ],
)
def test_accounts_errors(skill_dir, change, needle):
    mutate(skill_dir / ACC, change)
    errors = errors_for(skill_dir, ACC)
    assert any(needle in e for e in errors), errors


def test_request_template_rules(skill_dir):
    path = skill_dir / "templates" / "requests" / "tpa-erasure.md"
    text = path.read_text().replace("It is not legal advice.", "Trust me.")
    text = text.replace("{{full_name}}", "{{fullname}}", 1).replace("kind: erasure", "kind: poem")
    path.write_text(text)
    errors = errors_for(skill_dir, "templates/requests/tpa-erasure.md")
    assert any("disclaimer" in e for e in errors)
    assert any("fullname" in e for e in errors)
    assert any("kind" in e for e in errors)


def test_request_template_id_must_match_file(skill_dir):
    path = skill_dir / "templates" / "requests" / "followup-generic.md"
    path.write_text(path.read_text().replace("id: followup-generic", "id: other"))
    assert errors_for(skill_dir, "followup-generic.md")


def test_request_template_without_frontmatter(skill_dir):
    (skill_dir / "templates" / "requests" / "plain.md").write_text("Hello\n")
    assert errors_for(skill_dir, "templates/requests/plain.md")


def test_share_card_must_only_use_counts(skill_dir):
    path = skill_dir / "templates" / "share-card.svg"
    path.write_text(path.read_text().replace("</svg>", "<text>{{full_name}}</text></svg>"))
    errors = errors_for(skill_dir, "templates/share-card.svg")
    assert any("full_name" in e for e in errors)


def test_report_template_needs_placeholders(skill_dir):
    path = skill_dir / "templates" / "report.html"
    path.write_text(path.read_text().replace("{{item_rows}}", ""))
    assert any("item_rows" in e for e in errors_for(skill_dir, "templates/report.html"))


def test_validate_does_not_crash_on_wrong_types(skill_dir):
    mutate(skill_dir / SITE, lambda d: d.update(search="nope", optout=[], sources="x", covers="y", countries=None))
    mutate(skill_dir / JUR, lambda d: d.update(deadline=[], regulators={}, rights="z", applies_to=None, templates=[]))
    errors = validate.validate_skill(skill_dir)
    assert errors


def test_contract_leniencies_accepted(skill_dir):
    mutate(skill_dir / JUR, lambda d: d["authorized_agent"].update(allowed=None))
    mutate(skill_dir / "references/countries/zz/mailer.json", lambda d: d["search"].update(url_template=""))
    mutate(skill_dir / "references/countries/zz/mailer.json", lambda d: d.update(category="legal_route"))
    mutate(skill_dir / "references/countries/zz/oldbook.json", lambda d: d["optout"].update(expected_days=None))
    assert validate.validate_skill(skill_dir) == []


def test_empty_template_still_required_for_url_template_method(skill_dir):
    mutate(skill_dir / SITE, lambda d: d["search"].update(url_template=""))
    assert errors_for(skill_dir, "search.url_template")


def test_null_deadline_days_accepted(skill_dir):
    mutate(skill_dir / JUR, lambda d: d["deadline"].update(days=None, basis="days"))
    assert validate.validate_skill(skill_dir) == []
