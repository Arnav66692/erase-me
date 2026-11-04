from __future__ import annotations

import json
import os
import stat

import pytest

from erase_me import storage
from erase_me.errors import UsageError


def test_write_json_private_is_atomic_and_private(tmp_path):
    target = tmp_path / "data.json"
    storage.write_json_private(target, {"b": 1, "a": "é"})
    assert stat.S_IMODE(os.stat(target).st_mode) == 0o600
    text = target.read_text(encoding="utf-8")
    assert json.loads(text) == {"b": 1, "a": "é"}
    assert text.endswith("\n")
    assert "é" in text
    assert [p.name for p in tmp_path.iterdir()] == ["data.json"]


def test_overwrite_keeps_mode(tmp_path):
    target = tmp_path / "data.json"
    target.write_text("old")
    os.chmod(target, 0o644)
    storage.write_text_private(target, "new")
    assert target.read_text() == "new"
    assert stat.S_IMODE(os.stat(target).st_mode) == 0o600


def test_failed_write_leaves_old_file_and_no_temp(tmp_path):
    target = tmp_path / "data.json"
    storage.write_json_private(target, {"ok": True})

    class Boom:
        pass

    with pytest.raises(TypeError):
        storage.write_json_private(target, {"bad": Boom()})
    assert json.loads(target.read_text()) == {"ok": True}
    assert [p.name for p in tmp_path.iterdir()] == ["data.json"]


def test_read_json_missing_raises_friendly(tmp_path):
    with pytest.raises(UsageError) as info:
        storage.read_json(tmp_path / "nope.json", what="profile")
    assert "profile" in str(info.value)


def test_read_json_invalid_raises_friendly(tmp_path):
    bad = tmp_path / "bad.json"
    bad.write_text("{not json")
    with pytest.raises(UsageError) as info:
        storage.read_json(bad)
    assert "bad.json" in str(info.value)


def test_read_json_optional_returns_default(tmp_path):
    assert storage.read_json_optional(tmp_path / "nope.json") is None
    assert storage.read_json_optional(tmp_path / "nope.json", default={}) == {}
