#!/usr/bin/env python3
"""One local text/audio recognition request over Chrome's native-message protocol.

No URLs, file paths, commands, network clients or response tokens are accepted.
Recognition supplies only an answer; the broker must confirm challenge passage.
"""
from __future__ import annotations

import base64
import contextlib
import json
import os
from pathlib import Path
import re
import struct
import sys
from typing import BinaryIO

# Chrome invokes an isolated Python wrapper. Import only this trusted sibling.
sys.path.insert(0, str(Path(__file__).resolve().parent))
try:
    import captcha_provider as provider  # noqa: E402
except Exception:
    provider = None

MAX_REQUEST_BYTES = 768 * 1024
MAX_MEDIA_BYTES = 512 * 1024
INVALID_REQUEST = 'Invalid local challenge request.'
UNAVAILABLE = 'Local challenge recognition is unavailable.'


class InvalidRequest(ValueError):
    """A request exceeded the fixed native protocol."""


def _object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise InvalidRequest()
        result[key] = value
    return result


def _nonfinite(_value):
    raise InvalidRequest()


def _read_exact(stream: BinaryIO, size: int) -> bytes:
    chunks = []
    remaining = size
    while remaining:
        chunk = stream.read(remaining)
        if not isinstance(chunk, bytes) or not chunk or len(chunk) > remaining:
            raise InvalidRequest()
        chunks.append(chunk)
        remaining -= len(chunk)
    return b''.join(chunks)


def read_request(stream: BinaryIO) -> object:
    length = struct.unpack('<I', _read_exact(stream, 4))[0]
    if not 0 < length <= MAX_REQUEST_BYTES:
        raise InvalidRequest()
    try:
        return json.loads(_read_exact(stream, length).decode('utf-8'), object_pairs_hook=_object,
                          parse_constant=_nonfinite)
    except (ValueError, UnicodeError, TypeError, RecursionError):
        raise InvalidRequest() from None


def _media(value: object) -> bytes:
    ceiling = 4 * ((MAX_MEDIA_BYTES + 2) // 3)
    if not isinstance(value, str) or not value or len(value) > ceiling:
        raise InvalidRequest()
    try:
        result = base64.b64decode(value, validate=True)
    except (ValueError, UnicodeError):
        raise InvalidRequest() from None
    if not 0 < len(result) <= MAX_MEDIA_BYTES or base64.b64encode(result).decode('ascii') != value:
        raise InvalidRequest()
    return result


def handle(request: object) -> dict:
    if not isinstance(request, dict) or not isinstance(request.get('action'), str):
        raise InvalidRequest()
    action = request['action']
    keys = {'capabilities': {'action'}, 'recognize_image': {'action', 'media', 'alphabet'},
            'recognize_audio': {'action', 'media'}}
    if action not in keys or set(request) != keys[action]:
        raise InvalidRequest()
    media = None if action == 'capabilities' else _media(request['media'])
    if action == 'recognize_image' and (not isinstance(request['alphabet'], str)
                                      or not re.fullmatch(r'[A-Za-z0-9]{0,80}', request['alphabet'])):
        raise InvalidRequest()
    # Keep recognizer messages off stdout's framed channel and off stderr.
    try:
        with open(os.devnull, 'w', encoding='utf-8') as sink, contextlib.redirect_stdout(sink), contextlib.redirect_stderr(sink):
            if action == 'capabilities':
                value = provider.capabilities()
                if not isinstance(value, dict) or set(value) != {'image', 'audio'} or any(type(v) is not bool for v in value.values()):
                    raise ValueError()
                return {'ok': True, 'capabilities': value}
            if action == 'recognize_image':
                answer = provider.solve_image(media, alphabet=request['alphabet'], timeout=15)
                alphabet = request['alphabet'] or provider.DEFAULT_ALPHABET
                if not isinstance(answer, str) or not 1 <= len(answer) <= 64 or any(char not in alphabet for char in answer):
                    raise ValueError()
            else:
                answer = provider.solve_audio(media, timeout=30)
                if (not isinstance(answer, str) or not 1 <= len(answer) <= 200 or not any(c.isalnum() for c in answer)
                        or not answer.isprintable()):
                    raise ValueError()
            return {'ok': True, 'answer': answer}
    except Exception:
        return {'ok': False, 'error': UNAVAILABLE}


def serve_once(source: BinaryIO, destination: BinaryIO) -> None:
    try:
        response = handle(read_request(source))
    except (InvalidRequest, OSError):
        response = {'ok': False, 'error': INVALID_REQUEST}
    raw = json.dumps(response, ensure_ascii=True, separators=(',', ':')).encode('utf-8')
    destination.write(struct.pack('<I', len(raw)) + raw)
    destination.flush()


def main() -> int:
    try:
        serve_once(sys.stdin.buffer, sys.stdout.buffer)
        return 0
    except Exception:
        # Broken pipes and unexpected local failures expose no traceback or media.
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
