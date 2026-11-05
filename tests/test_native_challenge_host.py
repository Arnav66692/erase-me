"""Native-message recognition uses synthetic media and mocked local tools only."""
import base64
import io
import json
from pathlib import Path
import struct
import subprocess
import sys

import pytest

import native_challenge_host as host


def framed(value):
    raw = json.dumps(value).encode()
    return struct.pack('<I', len(raw)) + raw


def exchange(data):
    output = io.BytesIO()
    host.serve_once(io.BytesIO(data), output)
    raw = output.getvalue()
    assert len(raw) >= 4
    size = struct.unpack('<I', raw[:4])[0]
    assert size == len(raw) - 4
    assert size < 4096
    return json.loads(raw[4:])


def image_request(data=b'fake-image'):
    return {'action': 'recognize_image', 'media': base64.b64encode(data).decode(), 'alphabet': 'ABC123'}


def test_capabilities_are_exact_booleans_without_running_recognition(monkeypatch):
    monkeypatch.setattr(host.provider, 'capabilities', lambda: {'image': True, 'audio': False})
    monkeypatch.setattr(host.provider, 'solve_image', lambda *_args, **_kwargs: pytest.fail('No image requested'))
    assert exchange(framed({'action': 'capabilities'})) == {'ok': True, 'capabilities': {'image': True, 'audio': False}}


def test_image_decode_is_bounded_and_only_recognition_fields_reach_provider(monkeypatch):
    calls = []
    monkeypatch.setattr(host.provider, 'solve_image', lambda data, **kwargs: calls.append((data, kwargs)) or 'AB123')
    assert exchange(framed(image_request())) == {'ok': True, 'answer': 'AB123'}
    assert calls == [(b'fake-image', {'alphabet': 'ABC123', 'timeout': 15})]


def test_audio_uses_local_provider_and_one_fixed_time_budget(monkeypatch):
    calls = []
    monkeypatch.setattr(host.provider, 'solve_audio', lambda data, **kwargs: calls.append((data, kwargs)) or 'seven birds')
    request = {'action': 'recognize_audio', 'media': base64.b64encode(b'fake-audio').decode()}
    assert exchange(framed(request)) == {'ok': True, 'answer': 'seven birds'}
    assert calls == [(b'fake-audio', {'timeout': 30})]


@pytest.mark.parametrize('payload', [
    None, [], 'capabilities', {}, {'action': 'unknown'},
    {'action': 'capabilities', 'url': 'https://example.test/private'},
    {'action': 'recognize_image', 'media': 'YQ=='},
    {'action': 'recognize_audio', 'media': 'YQ==', 'path': '/private/file'},
    {'action': 'recognize_image', 'media': 'YQ==', 'alphabet': 'ABC;pwd'},
    {'action': 'recognize_image', 'media': 'YQ==', 'alphabet': '\n'},
    {'action': 'recognize_image', 'media': 'YQ==', 'alphabet': 'é'},
    {'action': 'recognize_image', 'media': 'YQ==', 'alphabet': 123},
    {'action': 'recognize_image', 'media': 'YQ==', 'alphabet': 'A' * 81},
    {'action': 'recognize_audio', 'media': ''},
    {'action': 'recognize_audio', 'media': 'not base64'},
    {'action': 'recognize_audio', 'media': ['YQ==']},
    {'action': 'recognize_audio', 'media': 'YR=='},
])
def test_strict_schema_and_canonical_base64_fail_before_provider(monkeypatch, payload):
    monkeypatch.setattr(host.provider, 'solve_image', lambda *_a, **_k: pytest.fail('Invalid request reached OCR'))
    monkeypatch.setattr(host.provider, 'solve_audio', lambda *_a, **_k: pytest.fail('Invalid request reached audio'))
    answer = exchange(framed(payload))
    assert answer == {'ok': False, 'error': host.INVALID_REQUEST}


@pytest.mark.parametrize('data', [
    b'', b'\x01', b'\x05\x00\x00', struct.pack('<I', 0),
    struct.pack('<I', 5) + b'{}',
    struct.pack('<I', host.MAX_REQUEST_BYTES + 1),
    struct.pack('<I', 0xFFFFFFFF),
    struct.pack('<I', 1) + b'\xff',
    struct.pack('<I', 1) + b'{',
])
def test_bad_frame_is_a_bounded_generic_protocol_error(data):
    assert exchange(data) == {'ok': False, 'error': host.INVALID_REQUEST}


def test_oversized_length_never_reads_the_declared_payload():
    class Input:
        def read(self, size):
            assert size == 4
            return struct.pack('<I', host.MAX_REQUEST_BYTES + 1)
    output = io.BytesIO()
    host.serve_once(Input(), output)
    assert b'false' in output.getvalue()


def test_short_reads_are_assembled_within_the_exact_frame(monkeypatch):
    monkeypatch.setattr(host.provider, 'capabilities', lambda: {'image': False, 'audio': True})
    class Chunks(io.BytesIO):
        def read(self, size=-1):
            return super().read(min(size, 2))
    output = io.BytesIO()
    host.serve_once(Chunks(framed({'action': 'capabilities'})), output)
    assert json.loads(output.getvalue()[4:])['capabilities']['audio'] is True


def test_duplicate_keys_nonfinite_numbers_and_extra_frames_are_not_interpreted(monkeypatch):
    monkeypatch.setattr(host.provider, 'capabilities', lambda: {'image': False, 'audio': False})
    for raw in (b'{"action":"capabilities","action":"recognize_audio"}', b'{"action":NaN}'):
        assert exchange(struct.pack('<I', len(raw)) + raw)['ok'] is False
    data = framed({'action': 'capabilities'}) + framed({'action': 'recognize_audio', 'media': 'YQ=='})
    assert exchange(data) == {'ok': True, 'capabilities': {'image': False, 'audio': False}}


def test_media_ceiling_precedes_recognition(monkeypatch):
    monkeypatch.setattr(host.provider, 'solve_image', lambda *_a, **_k: pytest.fail('Oversized media reached OCR'))
    data = b'a' * (host.MAX_MEDIA_BYTES + 1)
    assert exchange(framed(image_request(data))) == {'ok': False, 'error': host.INVALID_REQUEST}


@pytest.mark.parametrize('answer', ['', 'A' * 65, 'not allowed', '\nA', None, 123])
def test_provider_cannot_return_unbounded_or_out_of_alphabet_image_answers(monkeypatch, answer):
    monkeypatch.setattr(host.provider, 'solve_image', lambda *_a, **_k: answer)
    assert exchange(framed(image_request())) == {'ok': False, 'error': host.UNAVAILABLE}


def test_provider_errors_and_prints_never_escape_to_protocol_or_stderr(monkeypatch, capsys):
    secret = 'PRIVATE-MEDIA-AND-PATH-DO-NOT-LOG'
    def fail(*_args, **_kwargs):
        print(secret)
        print(secret, file=sys.stderr)
        raise RuntimeError(secret)
    monkeypatch.setattr(host.provider, 'solve_image', fail)
    answer = exchange(framed(image_request(secret.encode())))
    assert answer == {'ok': False, 'error': host.UNAVAILABLE}
    captured = capsys.readouterr()
    assert secret not in captured.out + captured.err + json.dumps(answer)


def test_subprocess_handles_malformed_message_without_traceback_or_media_echo():
    script = Path(host.__file__).resolve()
    result = subprocess.run([sys.executable, '-I', '-B', str(script)], input=struct.pack('<I', 5) + b'bad!!',
                            capture_output=True, timeout=5)
    assert result.returncode == 0
    assert result.stderr == b''
    assert json.loads(result.stdout[4:]) == {'ok': False, 'error': host.INVALID_REQUEST}
