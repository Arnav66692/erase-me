"""Local-first web API. Run with python -m webapp.server --demo."""
from __future__ import annotations

import argparse
import json
import mimetypes
import os
import re
import secrets
import threading
import time
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

from . import auth, store

STATIC = Path(__file__).parent / 'static'
EMAIL = re.compile(r'[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+')
COUNTRY = re.compile(r'[A-Z]{2}')
REGION = re.compile(r'[A-Z]{2}-[A-Z0-9]{1,3}')
MAX_BODY = 16384


def text_field(value, label, maximum=200):
    if not isinstance(value, str) or any(ord(ch) < 32 for ch in value):
        raise auth.AuthError(f'{label} must be text without control characters.')
    value = ' '.join(value.split())
    if not value or len(value) > maximum:
        raise auth.AuthError(f'{label} must be between 1 and {maximum} characters.')
    return value


def email_field(value):
    value = text_field(value, 'Email', 254).lower()
    if not EMAIL.fullmatch(value):
        raise auth.AuthError('Enter a valid email address.')
    return value


def automation_configured():
    try:
        from .adapters import configured
        return configured()
    except (ImportError, OSError, ValueError):
        return False


class WebServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True

    def __init__(self, address, demo=False, public_origin=None, *, manual=True, local_only=False):
        self.demo = demo
        self.worker = None
        self.manual = manual
        self.local_only = local_only
        self._manual_lock = threading.Lock()
        self._manual_user = None
        self._manual_thread = None
        self.public_origin = public_origin
        super().__init__(address, Handler)
        port = self.server_address[1]
        self.allowed_hosts = {f'127.0.0.1:{port}', f'localhost:{port}'}
        self.scheme = 'http'
        if public_origin:
            parsed = urlsplit(public_origin)
            if parsed.scheme != 'https' or not parsed.netloc or parsed.path not in ('', '/') or parsed.query or parsed.fragment:
                raise ValueError('ERASE_WEB_ORIGIN must be an HTTPS origin without a path.')
            self.allowed_hosts = {parsed.netloc}
            self.scheme = 'https'

    def trigger(self, user_id=None, *, explicit=False):
        if not self.worker:
            if explicit:
                raise auth.AuthError('The removal worker is unavailable.', 503)
            return False
        if not self.manual:
            if user_id:
                self.worker.request_run(user_id)
            self.worker.wake()
            return True
        # Verification, profile edits, resume and opening the app do not run jobs.
        if not explicit or not user_id:
            return False
        if not self._manual_lock.acquire(blocking=False):
            raise auth.AuthError('A check is already running. Refresh its status before starting another.', 409)
        self._manual_user = user_id
        self._manual_thread = threading.Thread(target=self._run_manual, args=(user_id,),
                                               name='erase-me-explicit-run', daemon=True)
        try:
            self._manual_thread.start()
        except Exception:
            self._manual_user = None
            self._manual_lock.release()
            raise
        return True

    def _run_manual(self, user_id):
        try:
            self.worker.request_run(user_id)
            deadline = time.monotonic() + 120
            for _ in range(4):
                remaining = deadline - time.monotonic()
                if remaining <= 0 or self.worker._stop.is_set():
                    break
                # No sleeps or wake-up timers: only this explicitly requested batch.
                processed = self.worker.run_once(user_id=user_id, immediate=True, max_seconds=remaining)
                if not processed:
                    break
        except Exception:
            import logging
            logging.getLogger(__name__).error('Explicit removal check failed; persisted jobs retain their state.')
        finally:
            self._manual_user = None
            self._manual_lock.release()

    def server_close(self):
        if self.worker:
            self.worker.stop()
        super().server_close()


class Handler(BaseHTTPRequestHandler):
    server_version = 'EraseMe'
    sys_version = ''

    def log_message(self, format, *args):
        # Requests can contain private listing paths; never write them to access logs.
        pass

    def headers_secure(self):
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'no-referrer')
        self.send_header('X-Frame-Options', 'DENY')
        self.send_header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
        self.send_header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'")
        if self.server.scheme == 'https':
            self.send_header('Strict-Transport-Security', 'max-age=31536000')

    def respond(self, body, status=200, *, cookie=None):
        data = json.dumps(body, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.headers_secure()
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(data)))
        if cookie is not None:
            suffix = '; Secure' if self.server.scheme == 'https' else ''
            age = auth.SESSION_LIFETIME if cookie else 0
            self.send_header('Set-Cookie', f'{auth.COOKIE}={cookie}; Path=/; HttpOnly; SameSite=Strict; Max-Age={age}{suffix}')
        self.end_headers()
        self.wfile.write(data)

    def check_request(self, mutation=False):
        host = self.headers.get('Host', '')
        if host not in self.server.allowed_hosts:
            raise auth.AuthError('This host is not allowed.', 403)
        if mutation:
            if self.headers.get('X-Erase-Me') != '1':
                raise auth.AuthError('Reload this page before continuing.', 403)
            if self.headers.get('Origin') != f'{self.server.scheme}://{host}':
                raise auth.AuthError('Cross-site requests are not allowed.', 403)
            if self.headers.get('Content-Type', '').split(';')[0].strip() != 'application/json':
                raise auth.AuthError('Expected a JSON request.', 415)
            if self.headers.get('Transfer-Encoding'):
                raise auth.AuthError('Chunked requests are not supported.', 400)

    def read_body(self):
        try:
            size = int(self.headers.get('Content-Length', '0'))
            if size < 0 or size > MAX_BODY:
                raise auth.AuthError('Request is too large.', 413)
            body = json.loads(self.rfile.read(size).decode('utf-8'))
            if not isinstance(body, dict):
                raise ValueError('not an object')
            return body
        except (ValueError, UnicodeError) as exc:
            raise auth.AuthError('Send a valid JSON object.') from exc

    def token(self):
        cookie = SimpleCookie()
        try:
            cookie.load(self.headers.get('Cookie', ''))
        except Exception:
            return None
        value = cookie.get(auth.COOKIE)
        return value.value if value else None

    def dispatch(self, mutation=False):
        try:
            self.check_request(mutation)
            self.connection.settimeout(20)
            path = urlsplit(self.path).path
            if not mutation:
                self.get_route(path)
            else:
                self.mutate_route(path, self.read_body())
        except auth.AuthError as exc:
            self.respond({'error': str(exc)}, exc.status)
        except (BrokenPipeError, ConnectionResetError, TimeoutError):
            return
        except Exception:
            self.respond({'error': 'The service could not complete this request. Please try again.'}, 500)

    def do_GET(self):
        self.dispatch()

    def do_POST(self):
        self.dispatch(True)

    def do_DELETE(self):
        self.dispatch(True)

    def get_route(self, path):
        if path == '/api/config':
            return self.respond({
                'mode': 'demo' if self.server.demo else 'live',
                'manual': self.server.manual,
                'local_only': self.server.local_only,
                'email_configured': self.server.demo or auth.email_configured(),
                'automation_configured': self.server.demo or self.server.local_only or automation_configured(),
                'authorization_statement': auth.LOCAL_AUTHORIZATION if self.server.local_only else auth.AUTHORIZATION,
                'authorization_version': auth.AUTHORIZATION_VERSION,
            })
        if path == '/api/dashboard':
            return self.respond(self.dashboard(auth.session_user(self.token())))
        if path.startswith('/api/'):
            raise auth.AuthError('Not found.', 404)
        allowed = {'/': 'index.html', '/index.html': 'index.html', '/app.js': 'app.js', '/hero.js': 'hero.js', '/styles.css': 'styles.css', '/fusion.css': 'fusion.css', '/favicon.svg': 'favicon.svg',
                   '/fonts/geist.woff2': 'fonts/geist.woff2', '/fonts/jetbrains-mono.woff2': 'fonts/jetbrains-mono.woff2'}
        name = allowed.get(path)
        bundled_fonts = ('instrument-serif.ttf', 'hanken-grotesk.ttf', 'vt323.ttf',
                         'cormorant-garamond-300-latin.woff2', 'cormorant-garamond-300-latin-ext.woff2',
                         'saira-extra-condensed-700-latin.woff2')
        if path in ('/fonts/' + font for font in bundled_fonts):
            name = path.lstrip('/')
        if not name or not (STATIC / name).is_file():
            raise auth.AuthError('Not found.', 404)
        data = (STATIC / name).read_bytes()
        self.send_response(200)
        self.headers_secure()
        content_type = mimetypes.guess_type(name)[0] or 'application/octet-stream'
        if name.endswith('.woff2'):
            content_type = 'font/woff2'
        elif name.endswith('.ttf'):
            content_type = 'font/ttf'
        elif content_type.startswith('text/') or content_type.endswith(('javascript', 'svg+xml')):
            content_type += '; charset=utf-8'
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def signup(self, body):
        name = text_field(body.get('name'), 'Name', 120)
        age = body.get('age')
        if type(age) is not int or not 18 <= age <= 120:
            raise auth.AuthError('Erase Me currently supports adults aged 18 or older. Enter your age in years.')
        email = email_field(body.get('email'))
        if body.get('authorized') is not True:
            raise auth.AuthError('Authorize removal requests for your own information to continue.')
        auth.rate_limit('email:' + email, 10)
        if self.server.local_only:
            token = auth.local_signup(name, age, email)
            return self.respond({'ok': True}, cookie=token)
        if not self.server.demo and not auth.email_configured():
            raise auth.AuthError('Email delivery is not configured. Ask the service operator to connect email.', 503)
        with store.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            existing = db.execute('SELECT id FROM users WHERE email=?', (email,)).fetchone()
            if existing:
                user_id = existing['id']
            else:
                user_id = secrets.token_urlsafe(18)
                stamp = store.now()
                db.execute(
                    'INSERT INTO users(id,name,age,email,authorized_at,authorization_version,authorization_statement,created_at) VALUES(?,?,?,?,?,?,?,?)',
                    (user_id, name, age, email, stamp, auth.AUTHORIZATION_VERSION, auth.AUTHORIZATION, stamp),
                )
                store.event(db, user_id, 'Removal authorization saved. Email verification is required before any work begins.')
        return self.respond(auth.issue_code(user_id, email, self.server.demo, signup={'name': name, 'age': age}))

    def mutate_route(self, path, body):
        if self.command == 'DELETE':
            if path != '/api/account':
                raise auth.AuthError('Not found.', 404)
            user = auth.session_user(self.token())
            if body.get('confirm') is not True:
                raise auth.AuthError('Confirm that you want to delete your account.')
            with store.connect() as db:
                db.execute('DELETE FROM users WHERE id=?', (user['id'],))
            return self.respond({'ok': True}, cookie='')
        if path in ('/api/signup', '/api/login', '/api/verify'):
            auth.rate_limit('ip:' + self.client_address[0], 60)
        if path == '/api/local-session':
            if not self.server.local_only:
                raise auth.AuthError('Local session access is unavailable in this mode.', 403)
            token = body.get('token')
            if not isinstance(token, str):
                raise auth.AuthError('A local access token is required.', 401)
            local_user = auth.session_user(token)
            if local_user.get('verification_method') != 'self_attested_local':
                raise auth.AuthError('This is not a local profile session.', 403)
            return self.respond({'ok': True}, cookie=token)
        if path == '/api/signup':
            return self.signup(body)
        if self.server.local_only and path in ('/api/login', '/api/verify'):
            raise auth.AuthError('Local profiles use this browser session. Email alone cannot sign into an existing profile.', 403)
        if path == '/api/login':
            email = email_field(body.get('email'))
            auth.rate_limit('email:' + email, 10)
            if not self.server.demo and not auth.email_configured():
                raise auth.AuthError('Email delivery is not configured. Ask the service operator to connect email.', 503)
            with store.connect() as db:
                user = db.execute('SELECT id FROM users WHERE email=? AND verified=1', (email,)).fetchone()
            response = auth.issue_code(user['id'], email, self.server.demo) if user else {
                'verification_required': True, 'challenge_id': secrets.token_urlsafe(32)}
            return self.respond(response)
        if path == '/api/verify':
            email = email_field(body.get('email'))
            code = body.get('code')
            challenge_id = body.get('challenge_id')
            if not isinstance(code, str) or not re.fullmatch(r'[0-9]{6}', code):
                raise auth.AuthError('Enter the six-digit code from your email.')
            if not isinstance(challenge_id, str) or not 20 <= len(challenge_id) <= 100:
                raise auth.AuthError('Request a new code from this browser and try again.', 401)
            token = auth.verify(email, code, challenge_id)
            self.server.trigger()
            return self.respond({'ok': True}, cookie=token)
        if path == '/api/logout':
            auth.logout(self.token())
            return self.respond({'ok': True}, cookie='')
        user = auth.session_user(self.token())
        if path == '/api/profile':
            return self.update_profile(user, body)
        if path == '/api/confirmation':
            site_id = body.get('site_id')
            if not isinstance(site_id, str) or not 1 <= len(site_id) <= 128:
                raise auth.AuthError('Choose a pending broker confirmation.')
            if not self.server.worker:
                raise auth.AuthError('The removal worker is unavailable.', 503)
            if not self.server.worker.confirmation_completed(user['id'], site_id):
                raise auth.AuthError('This request is not awaiting your email confirmation.', 409)
            self.server.trigger(user['id'], explicit=True)
            return self.respond({'ok': True})
        if path == '/api/campaign':
            action = body.get('action')
            if action not in ('pause', 'resume', 'run'):
                raise auth.AuthError('Choose pause, resume, or run.')
            if action == 'run' and user['status'] == 'paused':
                raise auth.AuthError('Resume protection before starting a check.', 409)
            if action == 'run':
                self.server.trigger(user['id'], explicit=True)
            with store.connect() as db:
                if action in ('pause', 'resume'):
                    db.execute('UPDATE users SET status=? WHERE id=?', ('paused' if action == 'pause' else 'active', user['id']))
                store.event(db, user['id'], {'pause': 'Protection paused. Any request already in progress may finish.', 'resume': 'Protection resumed.', 'run': 'A new check was queued.'}[action])
            if action == 'resume':
                self.server.trigger(user['id'])
            return self.respond({'ok': True})
        raise auth.AuthError('Not found.', 404)

    def update_profile(self, user, body):
        if not set(body) <= {'country', 'region', 'city'}:
            raise auth.AuthError('Only country, region, and city can be updated here.')
        values = {key: user.get(key) for key in ('country', 'region', 'city')}
        for key, value in body.items():
            values[key] = text_field(value, key.title(), 100) if value else None
        if values['country']:
            values['country'] = values['country'].upper()
            if not COUNTRY.fullmatch(values['country']):
                raise auth.AuthError('Use a two-letter country code, such as US or GB.')
        if values['region']:
            values['region'] = values['region'].upper()
            if not REGION.fullmatch(values['region']) or not values['country'] or not values['region'].startswith(values['country'] + '-'):
                raise auth.AuthError('Use a region within your country, such as US-CA.')
        with store.connect() as db:
            db.execute('UPDATE users SET country=?,region=?,city=? WHERE id=?', (*values.values(), user['id']))
            for key, value in values.items():
                if value:
                    db.execute('DELETE FROM questions WHERE user_id=? AND field=?', (user['id'], key))
            store.event(db, user['id'], 'Location details updated to improve matching.')
        if self.server.worker:
            self.server.worker.profile_changed(user['id'])
        return self.respond({'ok': True})

    def dashboard(self, user):
        with store.connect() as db:
            items = [dict(row) for row in db.execute('SELECT id,site_id,name,domain,status,detail,url,updated_at FROM items WHERE user_id=? ORDER BY name', (user['id'],))]
            activity = [dict(row) for row in db.execute('SELECT at,message FROM activity WHERE user_id=? ORDER BY id DESC LIMIT 50', (user['id'],))]
            questions = [dict(row) for row in db.execute('SELECT id,prompt,field FROM questions WHERE user_id=? ORDER BY id', (user['id'],))]
        statuses = [item['status'] for item in items]
        found = sum(s in ('found', 'requested', 'confirming', 'awaiting_confirmation', 'removed', 'relisted') for s in statuses)
        requested = sum(s in ('requested', 'confirming', 'awaiting_confirmation', 'removed') for s in statuses)
        with store.connect() as db:
            columns = {row['name'] for row in db.execute('PRAGMA table_info(jobs)')}
            if {'matched', 'first_submitted_at', 'user_id'} <= columns:
                counts = db.execute('SELECT SUM(matched=1) AS found, SUM(first_submitted_at IS NOT NULL) AS requested FROM jobs WHERE user_id=?', (user['id'],)).fetchone()
                found, requested = counts['found'] or 0, counts['requested'] or 0
        return {
            'profile': {key: user[key] for key in ('name', 'email', 'age', 'country', 'region', 'city')},
            'campaign': {**{key: user[key] for key in ('status', 'authorized_at', 'next_check_at')},
                         'next_check_at': None if self.server.manual else user['next_check_at'],
                         'run_in_progress': self.server._manual_user == user['id']},
            'counts': {
                'found': found,
                'requested': requested,
                'removed': statuses.count('removed'),
                'blocked': sum(s in ('blocked', 'needs_human', 'clarification', 'needs_info', 'awaiting_integration', 'failed', 'delivery_failed') for s in statuses),
            },
            'items': items, 'activity': activity, 'questions': questions,
            'mode': 'demo' if self.server.demo else 'live',
        }


def create_server(host='127.0.0.1', port=8765, *, demo=False, data_dir=None, start_worker=False, manual=True, local_only=False):
    origin = os.getenv('ERASE_WEB_ORIGIN')
    if local_only and (host not in ('127.0.0.1', 'localhost') or origin):
        raise ValueError('Local profiles require loopback access without a public origin.')
    if host not in ('127.0.0.1', 'localhost') and not origin:
        raise ValueError('Public binding requires ERASE_WEB_ORIGIN=https://your-domain and a TLS reverse proxy.')
    root = data_dir or Path(os.getenv('ERASE_WEB_HOME', str(Path.home() / ('.erase-me-web-local' if local_only else '.erase-me-web-demo' if demo else '.erase-me-web'))))
    store.init_db(Path(root), 'local' if local_only else 'demo' if demo else 'live')
    server = WebServer((host, port), demo, origin, manual=manual, local_only=local_only)
    if start_worker:
        from .automation import Worker
        server.worker = Worker(demo=demo)
        if not manual:
            server.worker.start()
    return server


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--port', type=int, default=8765)
    parser.add_argument('--local', action='store_true', help='private local profiles without email or inbox access')
    parser.add_argument('--manual', action='store_true', default=True, help='run only when Run check is clicked (default); no recurring worker')
    parser.add_argument('--demo', action='store_true', help='use simulated sites and show verification codes; never sends removal requests')
    args = parser.parse_args()
    try:
        server = create_server(args.host, args.port, demo=args.demo, start_worker=True, manual=True, local_only=args.local)
    except (ValueError, OSError) as exc:
        parser.error(str(exc))
    print(f'Erase Me {"DEMO (simulated results)" if args.demo else "live"}: http://{args.host}:{server.server_port} (on demand; recurring checks off)', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
