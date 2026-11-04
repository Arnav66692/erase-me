from __future__ import annotations

import pytest

from erase_me import templates
from erase_me.errors import RefusalError, UsageError
from conftest import FIXTURE_SKILL_DIR

TEMPLATES = FIXTURE_SKILL_DIR / "templates"

SAMPLE = """---
id: demo
kind: erasure
regimes: zz-tpa, zz-tv-rpa
subject: Erase {{full_name}}
---
Hello {{ full_name }}, {{unknown_thing}}.
"""


def test_parse_frontmatter():
    parsed = templates.parse_template(SAMPLE)
    assert parsed["meta"]["id"] == "demo"
    assert parsed["meta"]["kind"] == "erasure"
    assert parsed["meta"]["regimes"] == ["zz-tpa", "zz-tv-rpa"]
    assert parsed["meta"]["subject"] == "Erase {{full_name}}"
    assert parsed["body"] == "Hello {{ full_name }}, {{unknown_thing}}.\n"


@pytest.mark.parametrize("text", ["no frontmatter", "---\nid: x\nno end", "---\nnot a pair\n---\nbody"])
def test_parse_rejects_bad_frontmatter(text):
    with pytest.raises(UsageError):
        templates.parse_template(text)


def test_fill_replaces_known_and_marks_missing():
    filled, missing = templates.fill("Hi {{ full_name }} {{email}} {{nope}} {{email}}", {"full_name": "Zelda", "email": ""})
    assert filled == "Hi Zelda [[MISSING: email]] [[MISSING: nope]] [[MISSING: email]]"
    assert missing == ["email", "nope"]


def test_fill_does_not_expand_placeholders_inside_values():
    filled, _ = templates.fill("{{full_name}}", {"full_name": "{{email}}", "email": "secret@example.com"})
    assert filled == "{{email}}"


def test_placeholders_listed_once():
    assert templates.placeholders("{{a}} {{ b }} {{a}}") == ["a", "b"]


def test_load_request_template():
    parsed = templates.load_request_template(TEMPLATES, "tpa-erasure")
    assert parsed["meta"]["kind"] == "erasure"
    assert parsed["body"].rstrip().endswith(templates.DISCLAIMER)


def test_load_request_template_missing():
    with pytest.raises(UsageError):
        templates.load_request_template(TEMPLATES, "nope")


@pytest.mark.parametrize("bad", ["../report", "a/b", "", "UP"])
def test_load_request_template_rejects_traversal(bad):
    with pytest.raises(RefusalError):
        templates.load_request_template(TEMPLATES, bad)


def test_text_template_fallback(tmp_path):
    assert templates.load_text_template(tmp_path, "report.html", "FALLBACK") == "FALLBACK"
    assert "{{person_label}}" in templates.load_text_template(TEMPLATES, "report.html", "FALLBACK")
