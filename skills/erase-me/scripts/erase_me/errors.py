"""Exceptions with the exit codes from the CLI contract."""
from __future__ import annotations

EXIT_OK = 0
EXIT_USAGE = 2
EXIT_REFUSED = 3


class EraseMeError(Exception):
    """Base error. The message is shown to the user as is."""

    exit_code = EXIT_USAGE

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class UsageError(EraseMeError):
    """Bad input, missing files or a step run out of order. Exit code 2."""

    exit_code = EXIT_USAGE


class RefusalError(EraseMeError):
    """The engine refuses on purpose. Exit code 3."""

    exit_code = EXIT_REFUSED
