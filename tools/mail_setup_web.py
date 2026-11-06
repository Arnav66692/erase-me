#!/usr/bin/env python3
"""Open one local setup screen. No mail, broker request or scheduled service runs."""
from __future__ import annotations

import argparse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import hmac
import json
import os
from pathlib import Path
import re
import secrets
import sys
import tempfile
import threading
import time
import webbrowser

TOOLS = Path(__file__).resolve().parent
sys.path.insert(0, str(TOOLS))
import setup_removal_mail as setup  # noqa: E402

ASSETS = {'/': ('mail_setup_ui.html', 'text/html; charset=utf-8'),
          '/mail_setup_ui.js': ('mail_setup_ui.js', 'text/javascript; charset=utf-8'),
          '/mail_setup_ui.css': ('mail_setup_ui.css', 'text/css; charset=utf-8')}
MAX_BODY = 128 * 1024
MAX_CLIENT = 65536
REQUEST_KEYS = {'personal_email', 'mailbox', 'extension_id', 'browser', 'client_json',
                'removal_only', 'replace_registration', 'reconnect'}
MESSAGES = {
    'invalid_request': 'Review the setup fields and select only your Google Desktop client file.',
    'invalid_client': 'Select a valid Google Desktop OAuth client JSON file.',
    'client_required': 'Choose your Google Desktop client JSON file to authorize this separate account.',
    'registration_approval_required': 'Review and approve updating the existing companion registration first.',
    'forbidden': 'This local setup session could not authenticate the request. Reopen the setup screen.',
    'busy': 'A setup action is already running. Complete its Google window or close this setup.',
    'already_complete': 'This setup is complete. Return to Erase Me or close this screen.',
    'session_closed': 'This setup was closed or expired. Reopen it when ready. No new installation will start.',
    'setup_failed': 'Setup did not finish. Check the separate account, Desktop client and companion ID, then try again.',
}


class WebSetupError(setup.SetupError):
    def __init__(self, code):
        self.code = code
        super().__init__(MESSAGES[code])


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise WebSetupError('invalid_request')
        result[key] = value
    return result


def decode_json(raw):
    try:
        return json.loads(raw, object_pairs_hook=unique_object,
                          parse_constant=lambda _value: (_ for _ in ()).throw(ValueError()))
    except (ValueError, UnicodeError, TypeError, RecursionError):
        raise WebSetupError('invalid_request') from None


def validate_request(value):
    if (not isinstance(value, dict) or set(value) not in (REQUEST_KEYS, REQUEST_KEYS | {'allow_sending'})
            or value['removal_only'] is not True
            or type(value['replace_registration']) is not bool
            or type(value['reconnect']) is not bool
            or type(value.get('allow_sending', False)) is not bool
            or value['browser'] not in ('chrome', 'chromium')):
        raise WebSetupError('invalid_request')
    try:
        setup.oauth.private.personal_digest(value['personal_email'])
        setup.oauth.validate_mailbox(value['mailbox'], value['personal_email'])
        setup.installer.files.extension_id(value['extension_id'])
    except (ValueError, TypeError, AttributeError, setup.oauth.OAuthError):
        raise WebSetupError('invalid_request') from None
    source = value['client_json']
    if source is not None:
        try:
            size = len(source.encode('utf-8')) if isinstance(source, str) else 0
        except UnicodeError:
            size = 0
        if not 0 < size <= MAX_CLIENT:
            raise WebSetupError('invalid_client')
        if not isinstance(decode_json(source), dict):
            raise WebSetupError('invalid_client')
    return value


class SetupSession:
    def __init__(self, *, extension_id=None, browser='chrome', timeout=600,
                 clock=time.monotonic, runner=setup.run_setup, home=None,
                 config_path=None, platform=None, assets=TOOLS):
        if (type(timeout) not in (int, float) or not 30 <= timeout <= 900
                or browser not in ('chrome', 'chromium')):
            raise ValueError('Invalid local setup session.')
        if extension_id is not None:
            setup.installer.files.extension_id(extension_id)
        self.extension_id, self.browser = extension_id, browser
        self.clock, self.deadline, self.runner = clock, clock() + timeout, runner
        self.home, self.config_path, self.platform = home, config_path, platform
        self.assets = Path(assets)
        self.token = secrets.token_urlsafe(32)
        self.origin = None
        self.lock = threading.RLock()
        self.closed = False
        self.busy = False
        self.complete = False
        self.installation_started = False

    def ensure_active(self, stage=None):
        with self.lock:
            if self.closed or self.clock() >= self.deadline:
                self.closed = True
                if not (self.installation_started and stage == 'complete'):
                    raise WebSetupError('session_closed')
            if stage == 'before_install':
                # Reservation and close share a lock. A reserved installation may
                # finish; a close that wins first prevents installation entirely.
                self.installation_started = True

    def close(self):
        with self.lock:
            self.closed = True
            return {'closed': True, 'installation_started': self.installation_started}

    def info(self):
        self.ensure_active()
        return {'extension_id': self.extension_id, 'browser': self.browser}

    def run(self, value):
        value = validate_request(value)
        with self.lock:
            self.ensure_active()
            if self.busy:
                raise WebSetupError('busy')
            if self.complete:
                raise WebSetupError('already_complete')
            self.busy = True
        temporary = None
        try:
            self.ensure_active()
            if value['client_json'] is not None:
                path = (setup.oauth.default_config() if self.config_path is None else Path(self.config_path))
                directory = setup.oauth.private.safe_directory(path.parent, create=True)
                descriptor, name = tempfile.mkstemp(prefix='.setup-client-', suffix='.json', dir=directory)
                temporary = Path(name)
                with os.fdopen(descriptor, 'w', encoding='utf-8') as stream:
                    stream.write(value['client_json'])
                    stream.flush()
                    os.fsync(stream.fileno())
                try:
                    setup.oauth.load_client(temporary)
                except (setup.oauth.OAuthError, OSError, ValueError):
                    raise WebSetupError('invalid_client') from None

            def prompt(question):
                self.ensure_active()
                if question.startswith('Primary email'):
                    return value['personal_email']
                if question.startswith('Separate removal-only'):
                    return value['mailbox']
                if question.startswith('Does this separate account'):
                    return 'yes'
                if question.startswith('Update the existing local connector'):
                    if not value['replace_registration']:
                        raise WebSetupError('registration_approval_required')
                    return 'yes'
                if question.startswith('Private Google Desktop client JSON path'):
                    if temporary is None:
                        raise WebSetupError('client_required')
                    return str(temporary)
                raise WebSetupError('setup_failed')

            result = self.runner(extension_id=value['extension_id'], browser=value['browser'],
                                 reconnect=value['reconnect'], prompt=prompt, emit=lambda _line: None,
                                 home=self.home, config_path=self.config_path, platform=self.platform,
                                 ensure_active=self.ensure_active,
                                 **({'allow_sending': True} if value.get('allow_sending', False) else {}),
                                 **({'reuse_saved_client': True} if value.get('allow_sending', False)
                                    and value['reconnect'] and value['client_json'] is None else {}))
            expected = {'ok', 'installed', 'reused_connection', 'identity_checked', 'messages_read', 'scheduled_work'}
            if (not isinstance(result, dict) or set(result) != expected
                    or any(type(item) is not bool for item in result.values())
                    or not result['ok'] or not result['installed'] or not result['identity_checked']
                    or result['messages_read'] or result['scheduled_work']):
                raise WebSetupError('setup_failed')
            with self.lock:
                self.complete = True
            return {key: result[key] for key in expected - {'ok'}}
        except WebSetupError:
            raise
        except (setup.SetupError, setup.oauth.OAuthError, setup.installer.host.MailHostError, ValueError, OSError):
            with self.lock:
                code = 'session_closed' if self.closed or self.clock() >= self.deadline else 'setup_failed'
            raise WebSetupError(code) from None
        finally:
            try:
                if temporary is not None:
                    temporary.unlink(missing_ok=True)
            finally:
                with self.lock:
                    self.busy = False


def make_server(session, *, port=0):
    class Handler(BaseHTTPRequestHandler):
        server_version = 'EraseMeLocalSetup'

        def setup(self):
            super().setup()
            self.connection.settimeout(10)

        def log_message(self, *_args):
            pass

        def reply(self, status, data, content_type='application/json; charset=utf-8'):
            raw = json.dumps(data).encode('utf-8') if isinstance(data, dict) else data
            self.send_response(status)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', str(len(raw)))
            self.send_header('Cache-Control', 'no-store')
            self.send_header('Referrer-Policy', 'no-referrer')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.send_header('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self'; img-src data:; connect-src 'self'; form-action 'none'; frame-ancestors 'none'; base-uri 'none'")
            self.send_header('Connection', 'close')
            self.end_headers()
            self.close_connection = True
            try:
                self.wfile.write(raw)
            except (OSError, BrokenPipeError):
                pass

        def error(self, code, status=400):
            self.reply(status, {'ok': False, 'code': code, 'message': MESSAGES[code]})

        def boundary(self, *, authenticated=False, mutation=False):
            if (self.client_address[0] != '127.0.0.1'
                    or self.headers.get_all('Host', []) != [session.origin.removeprefix('http://')]):
                raise WebSetupError('forbidden')
            origins = self.headers.get_all('Origin', [])
            if (mutation and origins != [session.origin]) or (origins and origins != [session.origin]):
                raise WebSetupError('forbidden')
            if authenticated:
                tokens = self.headers.get_all('X-Erase-Setup', [])
                if (len(tokens) != 1 or not re.fullmatch(r'[A-Za-z0-9_-]{43}', tokens[0])
                        or not hmac.compare_digest(tokens[0], session.token)):
                    raise WebSetupError('forbidden')
            session.ensure_active()

        def do_GET(self):
            try:
                self.boundary(authenticated=self.path.startswith('/api/'))
                if self.path == '/api/info':
                    self.reply(200, {'ok': True, 'result': session.info()})
                elif self.path in ASSETS:
                    filename, kind = ASSETS[self.path]
                    path = session.assets / filename
                    if path.is_symlink() or not path.is_file() or path.stat().st_size > 512 * 1024:
                        raise WebSetupError('setup_failed')
                    self.reply(200, path.read_bytes(), kind)
                else:
                    self.error('invalid_request', 404)
            except WebSetupError as error:
                self.error(error.code, 403 if error.code == 'forbidden' else 410 if error.code == 'session_closed' else 400)
            except (OSError, ValueError):
                self.error('setup_failed')

        def do_POST(self):
            try:
                self.boundary(authenticated=True, mutation=True)
                if self.headers.get_all('Transfer-Encoding', []):
                    raise WebSetupError('invalid_request')
                lengths = self.headers.get_all('Content-Length', [])
                if len(lengths) != 1 or not lengths[0].isascii() or not lengths[0].isdigit() or not 0 < int(lengths[0]) <= MAX_BODY:
                    raise WebSetupError('invalid_request')
                if self.headers.get_all('Content-Type', []) not in (['application/json'], ['application/json; charset=utf-8']):
                    raise WebSetupError('invalid_request')
                size = int(lengths[0])
                raw = self.rfile.read(size)
                if len(raw) != size:
                    raise WebSetupError('invalid_request')
                value = decode_json(raw)
                if self.path == '/api/connect':
                    self.reply(200, {'ok': True, 'result': session.run(value)})
                elif self.path == '/api/close' and value == {}:
                    self.reply(200, {'ok': True, 'result': session.close()})
                else:
                    raise WebSetupError('invalid_request')
            except WebSetupError as error:
                status = 403 if error.code == 'forbidden' else 409 if error.code in ('busy', 'already_complete') else 410 if error.code == 'session_closed' else 400
                self.error(error.code, status)
            except Exception:
                self.error('setup_failed')

        def do_OPTIONS(self):
            self.error('forbidden', 405)

    class Server(ThreadingHTTPServer):
        daemon_threads = False
        block_on_close = True

        def __init__(self, *args, **kwargs):
            self.slots = threading.BoundedSemaphore(8)
            super().__init__(*args, **kwargs)

        def process_request(self, request, client_address):
            if not self.slots.acquire(blocking=False):
                self.close_request(request)
                return
            try:
                super().process_request(request, client_address)
            except BaseException:
                self.slots.release()
                raise

        def process_request_thread(self, request, client_address):
            try:
                super().process_request_thread(request, client_address)
            finally:
                self.slots.release()

        def handle_error(self, _request, _client_address):
            # No request body, local credential or provider detail enters logs.
            pass

    server = Server(('127.0.0.1', port), Handler)
    server.timeout = 0.5
    session.origin = 'http://127.0.0.1:' + str(server.server_port)
    return server


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--extension-id')
    parser.add_argument('--browser', choices=('chrome', 'chromium'), default='chrome')
    args = parser.parse_args(argv)
    server = None
    session = None
    try:
        session = SetupSession(extension_id=args.extension_id, browser=args.browser)
        server = make_server(session)
        if not webbrowser.open(session.origin + '/#token=' + session.token):
            raise ValueError()
        print('Local setup opened. Use that screen to authorize only your separate removal account. No mail or scheduled work starts here.')
        while not session.closed and session.clock() < session.deadline:
            server.handle_request()
        session.close()
        return 0
    except (ValueError, OSError):
        print('Local setup could not open. Check Python and the companion ID, then try again. No credentials were logged.')
        return 1
    except KeyboardInterrupt:
        return 1
    finally:
        if session is not None:
            session.close()
        if server is not None:
            server.server_close()


if __name__ == '__main__':
    raise SystemExit(main())
