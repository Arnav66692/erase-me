from __future__ import annotations

import pytest

from erase_me import ids
from erase_me.errors import RefusalError


@pytest.mark.parametrize("value", ["mom", "a", "dad-2", "0abc", "x" * 40])
def test_valid_person_ids_pass(value):
    assert ids.validate_person_id(value) == value


@pytest.mark.parametrize(
    "value",
    ["", "Mom", "-mom", "mom/../x", "../etc", "mom\n", "mom ", "x" * 41, "mom.json", "m_o", None, 5, "é"],
)
def test_invalid_person_ids_refused(value):
    with pytest.raises(RefusalError):
        ids.validate_person_id(value)


@pytest.mark.parametrize("value", ["spokeo", "zz-drop", "a" * 64])
def test_valid_item_ids_pass(value):
    assert ids.validate_item_id(value) == value


@pytest.mark.parametrize("value", ["", "a" * 65, "../ledger", "UP", "a/b", "a\n", ".hidden"])
def test_invalid_item_ids_refused(value):
    with pytest.raises(RefusalError):
        ids.validate_item_id(value)


def test_is_valid_helpers():
    assert ids.is_valid_person_id("mom")
    assert not ids.is_valid_person_id("../mom")
    assert ids.is_valid_item_id("a" * 64)
    assert not ids.is_valid_item_id("a" * 65)
