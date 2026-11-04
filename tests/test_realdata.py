"""Validates the real reference data and templates. May fail while the data is still being written."""
from __future__ import annotations

import pytest

from erase_me import validate
from conftest import REAL_SKILL_DIR


@pytest.mark.realdata
def test_real_references_and_templates_validate():
    errors = validate.validate_skill(REAL_SKILL_DIR)
    assert errors == [], "\n".join(errors[:40])
