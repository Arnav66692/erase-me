"""Single source of the current date and time, so tests can pin it."""
from __future__ import annotations

import datetime as dt


def today() -> dt.date:
    return dt.date.today()


def now_iso() -> str:
    return dt.datetime.now().astimezone().replace(microsecond=0).isoformat()
