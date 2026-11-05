"""Public capabilities only. Profiles and privacy-request state stay in browsers."""
from http.server import BaseHTTPRequestHandler
import json


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
        if self.path.split('?')[0] == '/api/config':
            return self.reply(200, {'mode': 'browser', 'browser_workspace': True,
                                   'manual': True, 'synthetic_only': False,
                                   'server_profiles': False, 'inbox_connected': False})
        self.reply(410, {'error': 'This endpoint is not used. Open the browser workspace.'})

    def reject_write(self):
        # Do not parse, echo or persist incoming personal details.
        self.reply(405, {'error': 'Profiles and request history are stored in your browser. No server account is created.'})

    do_POST = reject_write
    do_DELETE = reject_write
    do_PUT = reject_write
    do_PATCH = reject_write
