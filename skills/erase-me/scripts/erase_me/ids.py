"""Identifier validation. These checks keep every path inside the home folder."""
from __future__ import annotations

import re

from .errors import RefusalError

PERSON_ID_RE = re.compile(r"[a-z0-9][a-z0-9-]{0,39}")
ITEM_ID_RE = re.compile(r"[a-z0-9][a-z0-9-]{0,63}")


def is_valid_person_id(value: object) -> bool:
    return isinstance(value, str) and PERSON_ID_RE.fullmatch(value) is not None


def is_valid_item_id(value: object) -> bool:
    return isinstance(value, str) and ITEM_ID_RE.fullmatch(value) is not None


def validate_person_id(value: object) -> str:
    if not is_valid_person_id(value):
        raise RefusalError(
            "Person id must be 1 to 40 characters of lowercase letters, digits and hyphens, "
            "starting with a letter or digit. Example: mom"
        )
    return str(value)


def validate_item_id(value: object) -> str:
    if not is_valid_item_id(value):
        raise RefusalError(
            "Item id must be 1 to 64 characters of lowercase letters, digits and hyphens, "
            "starting with a letter or digit."
        )
    return str(value)
