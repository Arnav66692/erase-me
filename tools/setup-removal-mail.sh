#!/bin/sh
set -eu
ERASE_SETUP_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$ERASE_SETUP_DIR/.."
exec python3 -I -B tools/mail_setup_web.py "$@"
