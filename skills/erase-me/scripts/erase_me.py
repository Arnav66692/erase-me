#!/usr/bin/env python3
"""Erase Me entry point: python3 scripts/erase_me.py <command> ...

Standard library only. Makes no network requests. The agent opens URLs itself.
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from erase_me.cli import main  # noqa: E402

if __name__ == "__main__":
    sys.exit(main())
