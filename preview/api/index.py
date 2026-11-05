"""Public browser workspace and optional on-demand dedicated-mail receipt API."""
from http.server import BaseHTTPRequestHandler
import importlib.util
import json
from pathlib import Path

# Load the exact trusted project helper outside /api. Each Python file inside
# /api is an independently discovered Vercel Function, so implementation modules
# belong under /lib. File-relative loading also works in isolated API tests.
_spec = importlib.util.spec_from_file_location(
    'erase_removal_mail', Path(__file__).resolve().parents[1] / 'lib' / 'removal_mail.py')
removal_mail = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(removal_mail)

APP_ORIGIN = 'https://erase-me-preview.vercel.app'
MAX_BODY = 8192


class handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def reply(self, status, data):
        encoded = json.dumps(data).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Content-Length', str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def do_GET(self):
        path = self.path.split('?')[0]
        if path == '/api/config':
            return self.reply(200, {'mode': 'browser', 'browser_workspace': True,
                                   'manual': True, 'synthetic_only': False,
                                   'server_profiles': False, 'inbox_connected': False,
                                   'dedicated_removal_mailbox': removal_mail.status()})
        if path == '/api/removal-mail/status':
            return self.reply(200, removal_mail.status())
        self.reply(410, {'error': 'This endpoint is not used. Open the browser workspace.'})

    def reject_write(self):
        # Personal-profile writes remain rejected without reading their bodies.
        self.reply(405, {'error': 'Profiles and request history are stored in your browser. No server account is created.'})

    def do_POST(self):
        path = self.path.split('?')[0]
        if path not in ('/api/removal-mail/session', '/api/removal-mail/check', '/api/removal-mail/continue'):
            return self.reject_write()
        try:
            if (self.headers.get_all('Origin') != [APP_ORIGIN]
                    or self.headers.get_all('X-Erase-Me') != ['1']):
                raise removal_mail.MailError('Invalid mailbox request origin.', 403)
            private_headers = self.headers.get_all('X-Erase-Mail-Key', [])
            pilot_key = private_headers[0] if len(private_headers) == 1 else None
            removal_mail.authorize(pilot_key)
            if self.headers.get('Transfer-Encoding') is not None or len(self.headers.get_all('Content-Length', [])) != 1:
                raise removal_mail.MailError('Invalid mailbox request.', 400)
            if (len(self.headers.get_all('Content-Type', [])) != 1
                    or self.headers.get('Content-Type', '').split(';')[0].strip().lower() != 'application/json'):
                raise removal_mail.MailError('A JSON mailbox request is required.', 415)
            try:
                length = int(self.headers['Content-Length'])
            except (ValueError, TypeError):
                raise removal_mail.MailError('Invalid mailbox request.', 400) from None
            if not 0 < length <= MAX_BODY:
                raise removal_mail.MailError('Mailbox request is too large.', 413)
            body = removal_mail.parse_json(self.rfile.read(length))
            operation = {'/api/removal-mail/session': removal_mail.session,
                         '/api/removal-mail/check': removal_mail.check,
                         '/api/removal-mail/continue': removal_mail.continue_confirmation}[path]
            result = operation(body, pilot_key=pilot_key)
            self.reply(200, result)
        except removal_mail.MailError as error:
            self.reply(error.status, {'error': str(error)})
        except Exception:
            # Neither provider exceptions nor request content may reach clients/logs.
            self.reply(503, {'error': 'The dedicated mailbox is temporarily unavailable.'})

    do_DELETE = reject_write
    do_PUT = reject_write
    do_PATCH = reject_write
