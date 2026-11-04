"""Email verification and opaque sessions. No credentials or codes in logs."""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import secrets
import smtplib
import ssl
import time
from email.message import EmailMessage

from . import store

CODE_LIFETIME = 600
SESSION_LIFETIME = 7 * 24 * 3600
MAX_ATTEMPTS = 5
RESEND_DELAY = 60
COOKIE = 'erase_session'
LOCAL_AUTHORIZATION = (
    'I am requesting removal of my own personal information. I authorize Erase Me to use the '
    'details I enter to find matching listings and submit supported broker removal forms '
    'when I press Run check. My email address is self-reported; Erase Me has no access to '
    'my inbox. I will complete any verification required by a broker. No identity document '
    'uploads, account deletions, recurring checks, or emails sent from my account are authorized.'
)
AUTHORIZATION_VERSION = '2026-10-28-v1'
AUTHORIZATION = (
    'I am requesting removal of my own personal information. I authorize Erase Me to search '
    'for matching listings, send removal and follow-up requests using the details I provide, '
    'process removal confirmation emails, and recheck for new listings. I understand some '
    'sites may not permit removal without additional verification. I can pause or delete '
    'my account at any time. No identity document uploads or account deletion are authorized.'
)


class AuthError(Exception):
    def __init__(self, message: str, status: int = 400):
        self.status = status
        super().__init__(message)


def email_configured() -> bool:
    return bool(os.getenv('ERASE_SMTP_HOST') and os.getenv('ERASE_SMTP_FROM'))


def send_mail(recipient: str, subject: str, body: str, *, reply_to: str | None = None) -> None:
    if not email_configured():
        raise AuthError('Email delivery is not configured. Ask the service operator to connect email.', 503)
    message = EmailMessage()
    message['From'] = os.environ['ERASE_SMTP_FROM']
    message['To'] = recipient
    message['Subject'] = subject
    if reply_to:
        message['Reply-To'] = reply_to
    message.set_content(body)
    host = os.environ['ERASE_SMTP_HOST']
    use_ssl = os.getenv('ERASE_SMTP_SSL', 'false').lower() == 'true'
    port = int(os.getenv('ERASE_SMTP_PORT', '465' if use_ssl else '587'))
    context = ssl.create_default_context()
    try:
        if use_ssl:
            connection = smtplib.SMTP_SSL(host, port, timeout=20, context=context)
        else:
            connection = smtplib.SMTP(host, port, timeout=20)
        with connection:
            if not use_ssl:
                connection.starttls(context=context)
            username = os.getenv('ERASE_SMTP_USER')
            if username:
                connection.login(username, os.getenv('ERASE_SMTP_PASSWORD', ''))
            connection.send_message(message)
    except (OSError, smtplib.SMTPException, ValueError) as exc:
        raise AuthError('Email could not be delivered. Please try again later.', 503) from exc


def digest(value: str) -> str:
    return hashlib.sha256(value.encode('utf-8')).hexdigest()


def local_signup(name: str, age: int, email: str) -> str:
    """Create an isolated local profile; never claim ownership of the typed email."""
    token = secrets.token_urlsafe(32)
    with store.connect() as db:
        db.execute('BEGIN IMMEDIATE')
        if db.execute('SELECT 1 FROM users WHERE email=?', (email,)).fetchone():
            raise AuthError('This profile already exists. Reopen it using the local access tool; entering its email cannot sign you in.', 409)
        user_id, stamp = secrets.token_urlsafe(18), store.now()
        db.execute('INSERT INTO users(id,name,age,email,verified,verification_method,authorized_at,'
                   'authorization_version,authorization_statement,created_at) VALUES(?,?,?,?,1,?,?,?,?,?)',
                   (user_id, name, age, email, 'self_attested_local', stamp,
                    '2026-10-29-local-v1', LOCAL_AUTHORIZATION, stamp))
        db.execute('INSERT INTO sessions(digest,user_id,expires) VALUES(?,?,?)',
                   (digest(token), user_id, time.time() + SESSION_LIFETIME))
        store.event(db, user_id, 'Local profile saved. Email ownership is unverified. No inbox connected and no request sent.')
    return token


def rate_limit(subject: str, limit: int = 20, duration: int = 3600) -> None:
    """Persist bounded request counters so server restarts do not reset throttling."""
    stamp = time.time()
    key = digest(subject)
    blocked = False
    with store.connect() as db:
        db.execute('BEGIN IMMEDIATE')
        db.execute('DELETE FROM rate_limits WHERE window < ?', (stamp - 86400,))
        row = db.execute('SELECT count,window FROM rate_limits WHERE subject=?', (key,)).fetchone()
        count = row['count'] + 1 if row and row['window'] > stamp - duration else 1
        start = row['window'] if row and row['window'] > stamp - duration else stamp
        blocked = count > limit
        db.execute('INSERT OR REPLACE INTO rate_limits(subject,count,window) VALUES(?,?,?)', (key, count, start))
    if blocked:
        raise AuthError('Too many attempts. Please try again later.', 429)


def issue_code(user_id: str, email: str, demo: bool, *, signup: dict | None = None) -> dict:
    stamp = time.time()
    code = f'{secrets.randbelow(1000000):06d}'
    salt = secrets.token_hex(24)
    challenge_id = secrets.token_urlsafe(32)
    pending = dict(signup, authorized_at=store.now()) if signup is not None else None
    with store.connect() as db:
        db.execute('BEGIN IMMEDIATE')
        row = db.execute('SELECT created FROM challenges WHERE user_id=?', (user_id,)).fetchone()
        if row and row['created'] > stamp - RESEND_DELAY:
            raise AuthError('Please wait one minute before requesting another code.', 429)
        db.execute(
            'INSERT OR REPLACE INTO challenges(user_id,digest,salt,expires,attempts,created,flow_digest,signup_json) VALUES(?,?,?,?,0,?,?,?)',
            (user_id, digest(salt + code), salt, stamp + CODE_LIFETIME, stamp,
             digest(challenge_id), json.dumps(pending) if pending is not None else None),
        )
    if not demo:
        try:
            send_mail(email, 'Your Erase Me verification code',
                      f'Your verification code is {code}. It expires in 10 minutes.\n\n'
                      'Enter this code only in Erase Me. If you did not request it, ignore this email.')
        except AuthError:
            with store.connect() as db:
                db.execute('DELETE FROM challenges WHERE user_id=? AND digest=?', (user_id, digest(salt + code)))
            raise
    response = {'verification_required': True, 'challenge_id': challenge_id}
    if demo:
        response['demo_code'] = code
    return response


def verify(email: str, code: str, challenge_id: str) -> str:
    stamp = time.time()
    token = secrets.token_urlsafe(32)
    valid = False
    with store.connect() as db:
        db.execute('BEGIN IMMEDIATE')
        row = db.execute(
            'SELECT c.*,u.email,u.verified FROM challenges c JOIN users u ON u.id=c.user_id WHERE u.email=?', (email,)
        ).fetchone()
        if (row and row['attempts'] < MAX_ATTEMPTS and row['expires'] > stamp
                and row['flow_digest'] and hmac.compare_digest(row['flow_digest'], digest(challenge_id))):
            db.execute('UPDATE challenges SET attempts=attempts+1 WHERE user_id=?', (row['user_id'],))
            valid = hmac.compare_digest(row['digest'], digest(row['salt'] + code))
            if valid and not row['verified']:
                # Only the details authorized in this exact signup flow become active.
                pending = json.loads(row['signup_json']) if row['signup_json'] else None
                if pending is None:
                    valid = False
                else:
                    db.execute('UPDATE users SET name=?,age=?,authorized_at=?,authorization_version=?,authorization_statement=? WHERE id=?',
                               (pending['name'], pending['age'], pending['authorized_at'],
                                AUTHORIZATION_VERSION, AUTHORIZATION, row['user_id']))
            if valid:
                db.execute('UPDATE users SET verified=1 WHERE id=?', (row['user_id'],))
                db.execute('DELETE FROM challenges WHERE user_id=?', (row['user_id'],))
                db.execute('DELETE FROM sessions WHERE expires < ?', (stamp,))
                db.execute('INSERT INTO sessions(digest,user_id,expires) VALUES(?,?,?)',
                           (digest(token), row['user_id'], stamp + SESSION_LIFETIME))
    if not valid:
        raise AuthError('That code is invalid or expired. Request a new code and try again.', 401)
    return token


def session_user(token: str | None):
    if not token or len(token) > 100:
        raise AuthError('Sign in to continue.', 401)
    with store.connect() as db:
        row = db.execute(
            'SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id '
            'WHERE s.digest=? AND s.expires>? AND u.verified=1', (digest(token), time.time())
        ).fetchone()
    if not row:
        raise AuthError('Your session has expired. Sign in again.', 401)
    return dict(row)


def logout(token: str | None) -> None:
    if token:
        with store.connect() as db:
            db.execute('DELETE FROM sessions WHERE digest=?', (digest(token),))
