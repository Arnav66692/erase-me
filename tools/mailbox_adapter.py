"""Read-only removal-inbox lookup. Never opens links or marks messages read."""
from __future__ import annotations

import datetime as dt
import email
import email.policy
import email.utils
import imaplib
import os
import re
import ssl
from html.parser import HTMLParser
from urllib.parse import parse_qsl, urlsplit

MAX_BYTES = 262144
MAX_MESSAGES = 20


def configured() -> bool:
    return all(os.getenv(key) for key in (
        'ERASE_IMAP_HOST', 'ERASE_IMAP_USER', 'ERASE_IMAP_PASSWORD', 'ERASE_IMAP_AUTHSERV_ID',
        'ERASE_REMOVAL_INBOX',
    ))


class _Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls = []
        self.text = []

    def handle_starttag(self, tag, attrs):
        if tag == 'a':
            self.urls.extend(value for key, value in attrs if key == 'href' and value)

    def handle_data(self, data):
        self.text.append(data)


def _same_domain(value: str, domain: str) -> bool:
    return value.lower().strip().rstrip('.') == domain.lower().rstrip('.')


def authenticated(message, domain: str, authserv_id: str) -> bool:
    """The first result must be the operator's trusted inbound provider header."""
    headers = message.get_all('Authentication-Results', [])
    if not headers:
        return False
    result = ' '.join(str(headers[0]).split())
    parts = result.split(';')
    identity = parts[0].strip().split()
    if not identity or identity[0].lower() != authserv_id.lower():
        return False
    dmarc, aligned = False, False
    for part in parts[1:]:
        if re.search(r'\bdmarc=pass\b', part, re.I):
            found = re.search(r'\bheader\.from=([^\s;]+)', part, re.I)
            dmarc = bool(found and _same_domain(found[1].strip('"'), domain))
        if re.search(r'\bdkim=pass\b', part, re.I):
            found = re.search(r'\bheader\.d=([^\s;]+)', part, re.I)
            aligned = aligned or bool(found and _same_domain(found[1].strip('"'), domain))
        if re.search(r'\bspf=pass\b', part, re.I):
            found = re.search(r'\bsmtp\.mailfrom=([^\s;]+)', part, re.I)
            aligned = aligned or bool(found and _same_domain(found[1].strip('"').rsplit('@', 1)[-1], domain))
    return dmarc and aligned


def _candidate_url(url: str, domain: str) -> bool:
    try:
        parsed = urlsplit(url)
        host = (parsed.hostname or '').lower()
        if (parsed.scheme != 'https' or parsed.username or parsed.password or parsed.port not in (None, 443)
                or not (host == domain or host.endswith('.' + domain)) or len(url) > 2048
                or any(c.isspace() for c in url)):
            return False
        if any(key.lower() in ('url', 'redirect', 'redirect_uri', 'next', 'continue', 'return', 'return_to')
               for key, _ in parse_qsl(parsed.query)):
            return False
        path = parsed.path.lower()
        if any(word in path for word in ('password', 'reset', 'login', 'account', 'export')):
            return False
        return any(word in path for word in ('confirm', 'verify', 'removal', 'optout', 'opt-out'))
    except ValueError:
        return False


def candidate(raw: bytes, payload: dict, received_at: dt.datetime, authserv_id: str) -> dict | None:
    """Validate correlation, provenance, time, and purpose before returning a link."""
    if len(raw) > MAX_BYTES:
        return None
    recipient = payload.get('confirmation_recipient')
    request_id = payload.get('request_id', '')
    if not recipient or not request_id or f'+erase-{request_id}@' not in recipient:
        return None
    try:
        sent = dt.datetime.fromisoformat(payload['submitted_at']).astimezone(dt.timezone.utc)
        if received_at < sent or received_at > dt.datetime.now(dt.timezone.utc) + dt.timedelta(minutes=5):
            return None
        message = email.message_from_bytes(raw, policy=email.policy.default)
    except (ValueError, TypeError, KeyError):
        return None
    domain = payload['site']['domain'].lower()
    froms = email.utils.getaddresses(message.get_all('From', []))
    if len(froms) != 1 or not _same_domain(froms[0][1].rsplit('@', 1)[-1], domain):
        return None
    recipients = email.utils.getaddresses(message.get_all('To', []) + message.get_all('Delivered-To', []))
    if recipient.casefold() not in [address.casefold() for _, address in recipients]:
        return None
    if not authenticated(message, domain, authserv_id):
        return None
    links, body = [], []
    for part in message.walk():
        if part.get_content_maintype() != 'text' or part.get_content_disposition() == 'attachment':
            continue
        try:
            content = part.get_content()
        except (LookupError, UnicodeError, ValueError):
            continue
        if not isinstance(content, str):
            continue
        if part.get_content_type() == 'text/html':
            parser = _Links()
            parser.feed(content)
            links.extend(parser.urls)
            body.extend(parser.text)
        elif part.get_content_type() == 'text/plain':
            body.append(content)
            links.extend(re.findall(r'https://[^\s<>"\']+', content))
    text = str(message.get('Subject', '')) + ' ' + ' '.join(body)
    if not re.search(r'\b(remov\w*|opt[ -]?out|unlist\w*)\b', text, re.I):
        return None
    if not re.search(r'\b(confirm\w*|verif\w*)\b', text, re.I):
        return None
    candidates = list(dict.fromkeys(url.rstrip('.,)') for url in links if _candidate_url(url.rstrip('.,)'), domain)))
    # Multiple plausible confirmation links need a site-specific integration, never a guess.
    if len(candidates) != 1:
        return None
    return {'request_id': request_id, 'authenticated': True, 'sender_domain': domain,
            'received_at': received_at.isoformat(), 'confirmation_url': candidates[0], 'purpose': 'removal'}


def find_confirmation(payload: dict) -> dict | None:
    if not configured() or not payload.get('confirmation_recipient'):
        return None
    recipient = payload['confirmation_recipient']
    if not re.fullmatch(r'[A-Za-z0-9.!#$%&\'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+', recipient):
        return None
    client = imaplib.IMAP4_SSL(os.environ['ERASE_IMAP_HOST'], int(os.getenv('ERASE_IMAP_PORT', '993')),
                              ssl_context=ssl.create_default_context(), timeout=20)
    try:
        client.login(os.environ['ERASE_IMAP_USER'], os.environ['ERASE_IMAP_PASSWORD'])
        status, _ = client.select(os.getenv('ERASE_IMAP_FOLDER', 'INBOX'), readonly=True)
        if status != 'OK':
            return None
        status, data = client.uid('search', None, 'HEADER', 'To', '"' + recipient + '"')
        if status != 'OK' or not data or not isinstance(data[0], bytes):
            return None
        for uid in reversed(data[0].split()[-MAX_MESSAGES:]):
            status, parts = client.uid('fetch', uid, f'(INTERNALDATE RFC822.SIZE BODY.PEEK[]<0.{MAX_BYTES + 1}>)')
            if status != 'OK':
                continue
            for part in parts:
                if not isinstance(part, tuple) or len(part) != 2:
                    continue
                metadata, raw = part
                size = re.search(rb'RFC822.SIZE (\d+)', metadata)
                arrival = re.search(rb'INTERNALDATE "([^"]+)"', metadata)
                if not size or int(size[1]) > MAX_BYTES or not arrival:
                    continue
                try:
                    received = dt.datetime.strptime(arrival[1].decode('ascii'), '%d-%b-%Y %H:%M:%S %z')
                except (ValueError, UnicodeError):
                    continue
                result = candidate(raw, payload, received, os.environ['ERASE_IMAP_AUTHSERV_ID'])
                if result:
                    return result
        return None
    finally:
        try:
            client.logout()
        except (imaplib.IMAP4.error, OSError):
            pass

