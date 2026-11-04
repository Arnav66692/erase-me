"""Free local CAPTCHA media recognition; no network clients or cloud fallback.

Recognizes text images with Tesseract and short English audio with whisper.cpp.
These tools produce answers, not reCAPTCHA/Turnstile tokens. The browser must
submit an answer and observe the challenge's actual success state.
"""
from __future__ import annotations

import argparse
import json
import math
import os
from pathlib import Path
import re
import shutil
import signal
import string
import subprocess
import tempfile
import time

MAX_MEDIA_BYTES = 2 * 1024 * 1024
MAX_PIXELS = 4_000_000
MAX_DIMENSION = 4096
MAX_OUTPUT_BYTES = 4096
DEFAULT_ALPHABET = string.ascii_letters + string.digits


class CaptchaUnavailable(RuntimeError):
    """The local recognizer could not provide a usable answer."""


def _binary(variable: str, command: str) -> str:
    override = os.environ.get(variable, '').strip()
    candidate = str(Path(override).expanduser()) if override else shutil.which(command)
    if not candidate or not Path(candidate).is_file() or not os.access(candidate, os.X_OK):
        raise CaptchaUnavailable(f'Install {command} locally or set {variable} to its executable.')
    return str(Path(candidate).resolve())


def _model() -> Path:
    configured = os.environ.get('ERASE_WHISPER_MODEL', '').strip()
    path = Path(configured).expanduser() if configured else Path.home() / '.local/share/whisper-models/ggml-base.en.bin'
    if not path.is_file():
        raise CaptchaUnavailable('Set ERASE_WHISPER_MODEL to a local whisper.cpp English model file.')
    return path.resolve()


def capabilities() -> dict[str, bool]:
    result = {'image': False, 'audio': False}
    try:
        _binary('ERASE_TESSERACT_BIN', 'tesseract')
        result['image'] = True
    except CaptchaUnavailable:
        pass
    try:
        _binary('ERASE_FFMPEG_BIN', 'ffmpeg')
        _binary('ERASE_WHISPER_BIN', 'whisper-cli')
        _model()
        result['audio'] = True
    except CaptchaUnavailable:
        pass
    return result


def _deadline(timeout: float) -> float:
    if isinstance(timeout, bool) or not isinstance(timeout, (int, float)) or not math.isfinite(timeout) or not 0 < timeout <= 60:
        raise CaptchaUnavailable('Local recognition timeout must be between 0 and 60 seconds.')
    return time.monotonic() + timeout


def _run(command: list[str], deadline: float) -> str:
    remaining = deadline - time.monotonic()
    if remaining <= 0:
        raise CaptchaUnavailable('Local recognition timed out.')
    # Private temporary output avoids unbounded PIPE accumulation and PII logs.
    with tempfile.TemporaryFile() as output:
        try:
            child = subprocess.Popen(command, stdout=output, stderr=subprocess.DEVNULL,
                                     stdin=subprocess.DEVNULL, start_new_session=True)
            try:
                child.wait(timeout=remaining)
            except subprocess.TimeoutExpired:
                try:
                    os.killpg(child.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
                child.wait()
                raise CaptchaUnavailable('Local recognition timed out.') from None
            if child.returncode:
                raise CaptchaUnavailable('The local recognizer could not process this challenge.')
            output.seek(0)
            raw = output.read(MAX_OUTPUT_BYTES + 1)
        except OSError:
            raise CaptchaUnavailable('The local recognizer could not be started.') from None
    if len(raw) > MAX_OUTPUT_BYTES:
        raise CaptchaUnavailable('The local recognizer returned too much text.')
    try:
        return raw.decode('utf-8')
    except UnicodeDecodeError:
        raise CaptchaUnavailable('The local recognizer returned invalid text.') from None


def _media(data: bytes) -> None:
    if not isinstance(data, bytes) or not data or len(data) > MAX_MEDIA_BYTES:
        raise CaptchaUnavailable('Challenge media must be nonempty bytes no larger than 2 MiB.')


def _dimensions(data: bytes) -> tuple[int, int, str]:
    if data.startswith(b'\x89PNG\r\n\x1a\n') and len(data) >= 33 and data[12:16] == b'IHDR':
        return int.from_bytes(data[16:20], 'big'), int.from_bytes(data[20:24], 'big'), '.png'
    if data.startswith(b'\xff\xd8'):
        offset = 2
        # Read segment metadata only; native decoding follows the bounds checks.
        while offset + 4 <= len(data):
            if data[offset] != 0xFF:
                break
            while offset < len(data) and data[offset] == 0xFF:
                offset += 1
            if offset >= len(data):
                break
            marker = data[offset]
            offset += 1
            if marker in (0xD9, 0xDA):
                break
            if marker in (0x01, *range(0xD0, 0xD9)):
                continue
            length = int.from_bytes(data[offset:offset + 2], 'big')
            if length < 2 or offset + length > len(data):
                break
            if marker in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF) and length >= 8:
                height = int.from_bytes(data[offset + 3:offset + 5], 'big')
                width = int.from_bytes(data[offset + 5:offset + 7], 'big')
                return width, height, '.jpg'
            offset += length
    raise CaptchaUnavailable('Only bounded PNG or JPEG text challenges are supported.')


def _write(path: Path, data: bytes) -> None:
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'wb') as handle:
        handle.write(data)


def solve_image(data: bytes, *, alphabet: str = '', timeout: float = 15) -> str:
    deadline = _deadline(timeout)
    _media(data)
    width, height, suffix = _dimensions(data)
    if not (0 < width <= MAX_DIMENSION and 0 < height <= MAX_DIMENSION and width * height <= MAX_PIXELS):
        raise CaptchaUnavailable('Challenge image dimensions exceed the local recognition limit.')
    if not isinstance(alphabet, str) or len(alphabet) > 80 or any(ch not in DEFAULT_ALPHABET for ch in alphabet):
        raise CaptchaUnavailable('The challenge alphabet must contain only ASCII letters and digits.')
    alphabet = alphabet or DEFAULT_ALPHABET
    binary = _binary('ERASE_TESSERACT_BIN', 'tesseract')
    with tempfile.TemporaryDirectory(prefix='erase-captcha-') as directory:
        path = Path(directory) / ('challenge' + suffix)
        _write(path, data)
        raw = _run([binary, str(path), 'stdout', '--psm', '7', '-l', 'eng',
                    '-c', 'tessedit_char_whitelist=' + alphabet], deadline)
    answer = ''.join(raw.split())
    if not 1 <= len(answer) <= 64 or any(ch not in alphabet for ch in answer):
        raise CaptchaUnavailable('No usable text was recognized in this challenge.')
    return answer


def solve_audio(data: bytes, *, timeout: float = 30) -> str:
    deadline = _deadline(timeout)
    _media(data)
    wav = data.startswith(b'RIFF') and data[8:12] == b'WAVE'
    mp3 = data.startswith(b'ID3') or (len(data) > 2 and data[0] == 0xFF and data[1] & 0xE0 == 0xE0)
    if not (wav or mp3 or data.startswith(b'OggS')):
        raise CaptchaUnavailable('Only WAV, MP3 or OGG audio challenges are supported.')
    ffmpeg = _binary('ERASE_FFMPEG_BIN', 'ffmpeg')
    whisper = _binary('ERASE_WHISPER_BIN', 'whisper-cli')
    model = _model()
    with tempfile.TemporaryDirectory(prefix='erase-captcha-') as directory:
        root = Path(directory)
        source, converted, output = root / 'challenge.media', root / 'challenge.wav', root / 'transcript'
        _write(source, data)
        # Restrict protocols so media cannot refer to a remote playlist/resource.
        _run([ffmpeg, '-nostdin', '-hide_banner', '-loglevel', 'error', '-protocol_whitelist', 'file,pipe',
              '-i', str(source), '-t', '30', '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', str(converted)], deadline)
        if not converted.is_file() or converted.stat().st_size > 1_100_000:
            raise CaptchaUnavailable('Audio conversion did not produce a bounded local file.')
        os.chmod(converted, 0o600)
        # Let whisper.cpp select the available local GPU/CPU backend. Forcing
        # CPU makes even short clips exceed the budget on some installations.
        _run([whisper, '-m', str(model), '-f', str(converted), '-l', 'en', '-nt', '-np',
              '-otxt', '-of', str(output)], deadline)
        transcript = output.with_suffix('.txt')
        if not transcript.is_file() or transcript.stat().st_size > MAX_OUTPUT_BYTES:
            raise CaptchaUnavailable('No bounded local transcript was produced.')
        os.chmod(transcript, 0o600)
        try:
            answer = ' '.join(transcript.read_text(encoding='utf-8').split())
        except (OSError, UnicodeError):
            raise CaptchaUnavailable('The local transcript could not be read.') from None
    if (not 1 <= len(answer) <= 200 or not any(ch.isalnum() for ch in answer)
            or any(not ch.isprintable() for ch in answer) or re.fullmatch(r'\[.*\]|\(.*\)', answer)):
        raise CaptchaUnavailable('No usable speech was recognized in this challenge.')
    return answer


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', required=True, help='report local recognizer availability')
    parser.parse_args()
    available = capabilities()
    print(json.dumps(available))
    return 0 if any(available.values()) else 1


if __name__ == '__main__':
    raise SystemExit(main())
