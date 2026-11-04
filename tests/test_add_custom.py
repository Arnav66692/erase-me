"""The add command: sites found by search that have no reference file."""
from __future__ import annotations

import json
import os
import stat

import pytest

from erase_me import catalog, ledger, templates
from conftest import PERSON

NOW = "2026-10-25T10:00:00-07:00"
SITE_NAME = "Lista Pessoas Quuxbr"
SITE_DOMAIN = "listapessoas-quuxbr.example.com.br"
SITE_EMAIL = "privacidade@listapessoas-quuxbr.example.com.br"
EVIDENCE = "https://listapessoas-quuxbr.example.com.br/p/zelda-777"


def add(cli, *extra, person=PERSON, item="lista-quux"):
    return cli("add", person, item, "--name", SITE_NAME, "--domain", SITE_DOMAIN, *extra)


def load_ledger(home, person=PERSON):
    return json.loads((home / "people" / person / "ledger.json").read_text())


def custom_item(home, item_id="lista-quux", person=PERSON):
    return next(i for i in load_ledger(home, person)["items"] if i["item_id"] == item_id)


def test_add_found_with_evidence(cli, ready_person, home):
    result = add(cli, "--email", SITE_EMAIL, "--evidence", EVIDENCE, "--evidence", EVIDENCE + "-b",
                 "--category", "people_search", "--json")
    assert result.code == 0, result.err
    data = result.json()["data"]
    assert data["status"] == "found" and data["regime"] == "zz-tpa"
    item = custom_item(home)
    assert item["source"] == "custom"
    assert item["channel"] == "legal_request"
    assert item["status"] == "found"
    assert item["evidence_urls"] == [EVIDENCE, EVIDENCE + "-b"]
    assert item["site"] == {"name": SITE_NAME, "domain": SITE_DOMAIN, "email": SITE_EMAIL, "category": "people_search"}
    assert [h["status"] for h in item["history"]] == ["found"]
    path = home / "people" / PERSON / "ledger.json"
    assert stat.S_IMODE(os.stat(path).st_mode) == 0o600


def test_add_planned_without_evidence(cli, ready_person, home):
    assert add(cli).code == 0
    item = custom_item(home)
    assert item["status"] == "planned"
    assert item["site"]["email"] is None and item["site"]["category"] is None


def test_add_human_output(cli, ready_person):
    result = add(cli, "--email", SITE_EMAIL, "--evidence", EVIDENCE)
    assert result.code == 0
    assert "Added lista-quux" in result.out
    assert "draft zelda lista-quux" in result.out


def test_add_refuses_duplicates(cli, ready_person):
    assert add(cli).code == 0
    again = add(cli)
    assert again.code == 2 and "already" in again.err
    assert add(cli, item="peoplefind").code == 2


@pytest.mark.parametrize(
    "extra, code",
    [
        (("--domain", "https://x.example.com"), 2),
        (("--email", "nope"), 2),
        (("--evidence", "javascript:alert(1)"), 2),
        (("--category", "gossip"), 2),
        (("--regime", "zz-nope"), 2),
        (("--regime", "zy-npa"), 3),
    ],
)
def test_add_validation(cli, ready_person, extra, code):
    args = ["add", PERSON, "lista-quux", "--name", SITE_NAME, "--domain", SITE_DOMAIN]
    if extra[0] == "--domain":
        args = args[:-1] + [extra[1]]
    else:
        args += list(extra)
    assert cli(*args).code == code


@pytest.mark.parametrize("bad_id", ["../x", "Lista", "a" * 65])
def test_add_bad_item_id(cli, ready_person, bad_id):
    assert add(cli, item=bad_id).code == 3


def test_add_needs_consent(cli, home):
    result = add(cli, person="nobody")
    assert result.code == 3
    assert not (home / "people" / "nobody").exists()


def test_add_bad_name(cli, ready_person):
    assert cli("add", PERSON, "lista-quux", "--name", "bad\nname", "--domain", SITE_DOMAIN).code == 2


def test_add_without_plan_creates_ledger(cli, today, home):
    cli("consent", PERSON, "--relationship", "self", "--method", "self")
    cli("intake", PERSON, "--name", "Zelda Quuxington", "--country", "ZZ")
    assert add(cli).code == 0
    assert [i["item_id"] for i in load_ledger(home)["items"]] == ["lista-quux"]
    assert cli("plan", PERSON).code == 0
    assert "lista-quux" in [i["item_id"] for i in load_ledger(home)["items"]]


def test_add_with_no_in_force_regime_uses_generic_erasure(cli, today, home, skill_dir):
    (skill_dir / "templates" / "requests" / "generic-erasure.md").write_text(
        "---\nid: generic-erasure\nkind: erasure\nregimes: any\nsubject: Please delete my data\n---\n"
        "To {{recipient_name}} ({{recipient_email}}). Delete {{full_name}}.\n\n" + templates.DISCLAIMER + "\n"
    )
    cli("consent", "ana", "--relationship", "self", "--method", "self")
    cli("intake", "ana", "--name", "Ana Example", "--country", "ZY")
    cli("plan", "ana")
    result = add(cli, "--email", SITE_EMAIL, "--json", person="ana")
    assert result.json()["data"]["regime"] is None
    draft = cli("draft", "ana", "lista-quux", "--json").json()["data"]["drafts"][0]
    assert draft["template_id"] == "generic-erasure"
    assert draft["recipient_email"] == SITE_EMAIL
    assert any("No privacy law matched" in w for w in draft["warnings"])
    text = (home / "people" / "ana" / "drafts" / "lista-quux-erasure.md").read_text()
    assert f"To {SITE_NAME} ({SITE_EMAIL})" in text


def test_custom_item_flows_through_every_command(cli, ready_person, home, today):
    add(cli, "--email", SITE_EMAIL, "--evidence", EVIDENCE)
    draft = cli("draft", PERSON, "lista-quux", "--json").json()["data"]["drafts"][0]
    assert draft["recipient_name"] == SITE_NAME and draft["recipient_email"] == SITE_EMAIL
    text = (home / "people" / PERSON / "drafts" / "lista-quux-erasure.md").read_text()
    assert f"To {SITE_NAME} ({SITE_EMAIL})" in text and EVIDENCE in text

    view = next(i for i in cli("search-urls", PERSON, "--json").json()["data"]["items"] if i["item_id"] == "lista-quux")
    assert view["name"] == SITE_NAME and view["optout_email"] == SITE_EMAIL and view["method"] == "legal_request"
    assert view["steps"]

    requested = cli("record", PERSON, "lista-quux", "requested", "--json").json()["data"]
    assert requested["due_on"] == "2026-11-25"
    today("2026-12-01")
    rows = cli("deadlines", PERSON, "--json").json()["data"]["overdue"]
    assert rows[0]["name"] == SITE_NAME

    stats = cli("stats", PERSON, "--json").json()["data"]
    assert stats["found"] == 1 and stats["requested"] == 1

    cli("record", PERSON, "lista-quux", "needs_human", "--note", "They asked for ID")
    groups = {g["requirement"]: g for g in cli("tasks", PERSON, "--json").json()["data"]["groups"]}
    assert groups["needs_human"]["items"][0]["name"] == SITE_NAME


def test_report_escapes_custom_site_values(cli, ready_person, home):
    evil = 'Evil <script>alert("x")</script> Site'
    cli("add", PERSON, "evil-site", "--name", evil, "--domain", SITE_DOMAIN, "--evidence", EVIDENCE + "?a=<b>")
    cli("report", PERSON)
    html = (home / "people" / PERSON / "report.html").read_text()
    assert "<script>alert" not in html
    assert "Evil &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; Site" in html
    assert "?a=&lt;b&gt;" in html


def test_catalog_describes_custom_item():
    cat = catalog.load_catalog(FIXTURE_REFS, "ZZ")
    item = ledger.new_custom_item(
        "lista-quux", {"name": SITE_NAME, "domain": SITE_DOMAIN, "email": SITE_EMAIL, "category": None},
        regime="zz-tpa", evidence=[], now=NOW,
    )
    info = catalog.describe(cat, item)
    assert info["name"] == SITE_NAME
    assert info["domain"] == SITE_DOMAIN
    assert info["email"] == SITE_EMAIL
    assert info["category"] == "unknown"
    assert info["method"] == "legal_request"
    assert info["verified"] is False


from conftest import FIXTURE_SKILL_DIR  # noqa: E402

FIXTURE_REFS = FIXTURE_SKILL_DIR / "references"
