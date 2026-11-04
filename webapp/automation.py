"""Durable per-site removal jobs. Provider errors never count as removals."""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import threading
import time
import uuid

from . import adapters, auth, email_routes, engine, form_routes, notifications, store

SCHEMA = '''
CREATE TABLE IF NOT EXISTS jobs (
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 site_id TEXT NOT NULL, site_json TEXT NOT NULL,
 phase TEXT NOT NULL DEFAULT 'scan', next_at TEXT,
 attempts INTEGER NOT NULL DEFAULT 0, request_id TEXT NOT NULL,
 matched INTEGER NOT NULL DEFAULT 0, first_submitted_at TEXT, submitted_at TEXT,
 confirmation_ref TEXT, confirmation_address TEXT, profile_fingerprint TEXT, check_index INTEGER NOT NULL DEFAULT 0,
 cycles INTEGER NOT NULL DEFAULT 0, followup_sent INTEGER NOT NULL DEFAULT 0,
 last_verified_removed INTEGER NOT NULL DEFAULT 0,
 in_flight INTEGER NOT NULL DEFAULT 0, claim_at TEXT,
 PRIMARY KEY(user_id,site_id)
);
CREATE INDEX IF NOT EXISTS jobs_due ON jobs(next_at);
'''
DAY = 86400
HOLD = {'clarification', 'integration', 'blocked', 'uncertain', 'done'}
MESSAGES = {
    'captcha': 'A CAPTCHA could not be completed. Other sites continue.',
    'id_required': 'This route requires an identity document. No documents will be requested or uploaded.',
    'unsupported': 'This site needs an automation route that is not available yet.',
    'error': 'The site could not be checked. We will retry within the retry limit.',
}


def now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def iso(value: dt.datetime) -> str:
    return value.isoformat()


def parse(value: str) -> dt.datetime:
    return dt.datetime.fromisoformat(value).astimezone(dt.timezone.utc)


class Worker:
    def __init__(self, demo: bool = False):
        self.demo = demo
        self._stop = threading.Event()
        self._wake = threading.Event()
        self._lock = threading.Lock()
        self._thread = None
        with store.connect() as db:
            db.executescript(SCHEMA)
            columns = {r['name'] for r in db.execute('PRAGMA table_info(jobs)')}
            if 'last_verified_removed' not in columns:
                db.execute('ALTER TABLE jobs ADD COLUMN last_verified_removed INTEGER NOT NULL DEFAULT 0')
            if 'confirmation_address' not in columns:
                db.execute('ALTER TABLE jobs ADD COLUMN confirmation_address TEXT')
            if 'profile_fingerprint' not in columns:
                db.execute('ALTER TABLE jobs ADD COLUMN profile_fingerprint TEXT')
            if 'form_started_at' not in columns:
                db.execute('ALTER TABLE jobs ADD COLUMN form_started_at TEXT')
        notifications.initialize()

    def start(self):
        if self._thread and self._thread.is_alive():
            return
        self._thread = threading.Thread(target=self._loop, name='erase-me-worker', daemon=True)
        self._thread.start()

    def wake(self):
        self._wake.set()

    def stop(self):
        self._stop.set()
        self._wake.set()
        if self._thread:
            self._thread.join(timeout=2)

    def _loop(self):
        while not self._stop.is_set():
            try:
                self.run_once()
            except Exception:
                # A database/provider error must not kill the scheduling thread or leak profile values.
                import logging
                logging.getLogger(__name__).error('Removal worker cycle failed; jobs remain persisted.')
            self._wake.wait(1 if self.demo else 15)
            self._wake.clear()

    def request_run(self, user_id: str):
        with store.connect() as db:
            # Never reset an uncertain external write. It needs reconciliation, not resubmission.
            db.execute("UPDATE jobs SET next_at=?, attempts=0, phase=CASE WHEN phase IN "
                       "('clarification','integration') THEN 'scan' ELSE phase END "
                       "WHERE user_id=? AND in_flight=0 AND phase NOT IN ('uncertain','blocked','done')",
                       (iso(now()), user_id))
        self.wake()

    def profile_changed(self, user_id: str):
        with store.connect() as db:
            targets = [r['site_id'] for r in db.execute(
                "SELECT site_id FROM jobs WHERE user_id=? AND in_flight=0 AND phase IN "
                "('scan','submit','clarification','integration')", (user_id,))]
            for site_id in targets:
                db.execute("UPDATE jobs SET phase='scan',next_at=?,attempts=0,profile_fingerprint=NULL,"
                           'matched=CASE WHEN first_submitted_at IS NULL THEN 0 ELSE matched END '
                           'WHERE user_id=? AND site_id=?', (iso(now()), user_id, site_id))
                db.execute("UPDATE items SET status='queued',url=NULL,detail=? WHERE user_id=? AND site_id=?",
                           ('Profile updated. Checking the match again before submitting.', user_id, site_id))
        self.wake()

    @staticmethod
    def _fingerprint(user):
        fields = {key: user.get(key) for key in ('name', 'age', 'email', 'country', 'region', 'city')}
        return hashlib.sha256(json.dumps(fields, sort_keys=True).encode()).hexdigest()

    def _question(self, db, user_id: str, field: str, prompt: str):
        if not db.execute('SELECT 1 FROM questions WHERE user_id=? AND field=?', (user_id, field)).fetchone():
            db.execute('INSERT INTO questions(id,user_id,prompt,field) VALUES(?,?,?,?)',
                       (uuid.uuid4().hex, user_id, prompt, field))

    def _seed(self, user: dict, stamp: str):
        plans = adapters.demo_sites() if self.demo else engine.plan(user)
        with store.connect() as db:
            if not self.demo and not user.get('country'):
                self._question(db, user['id'], 'country',
                               'Which country do you live in? This selects the right directories and removal routes.')
            for site in plans:
                db.execute('INSERT OR IGNORE INTO items(id,user_id,site_id,name,domain,status,detail,updated_at) '
                           'VALUES(?,?,?,?,?,?,?,?)', (uuid.uuid4().hex, user['id'], site['id'], site['name'],
                           site['domain'] or '', 'queued', 'Waiting for a first check.', stamp))
                db.execute('INSERT OR IGNORE INTO jobs(user_id,site_id,site_json,next_at,request_id) VALUES(?,?,?,?,?)',
                           (user['id'], site['id'], json.dumps(site), stamp, uuid.uuid4().hex))
                db.execute('UPDATE jobs SET site_json=? WHERE user_id=? AND site_id=?',
                           (json.dumps(site), user['id'], site['id']))
            ids = {s['id'] for s in plans}
            for row in db.execute('SELECT site_id FROM jobs WHERE user_id=?', (user['id'],)).fetchall():
                if row['site_id'] not in ids:
                    db.execute("UPDATE jobs SET phase='blocked',next_at=NULL WHERE user_id=? AND site_id=?",
                               (user['id'], row['site_id']))
                    db.execute("UPDATE items SET status='blocked',detail=? WHERE user_id=? AND site_id=?",
                               ('Outside the current country selection.', user['id'], row['site_id']))

    def run_once(self, user_id=None, *, immediate=False, max_seconds=None):
        if not self._lock.acquire(blocking=False):
            return 0
        processed = 0
        deadline = time.monotonic() + max_seconds if max_seconds is not None else None
        try:
            stamp = iso(now())
            with store.connect() as db:
                users = [dict(r) for r in db.execute(
                    "SELECT * FROM users WHERE verified=1 AND status='active' AND authorized_at IS NOT NULL"
                    + (' AND id=?' if user_id else ''), (user_id,) if user_id else ())]
            for user in users:
                self._seed(user, stamp)
            self._recover(stamp, user_id=user_id)
            with store.connect() as db:
                due_sql = 'j.next_at<=?'
                params = [stamp]
                if immediate:
                    due_sql = "(j.next_at<=? OR (j.phase IN ('scan','submit') AND j.next_at<=?))"
                    params.append(iso(parse(stamp) + dt.timedelta(seconds=3)))
                if user_id:
                    due_sql += ' AND j.user_id=?'
                    params.append(user_id)
                due = [dict(r) for r in db.execute(
                    "SELECT j.* FROM jobs j JOIN users u ON u.id=j.user_id WHERE u.verified=1 "
                    "AND u.status='active' AND u.authorized_at IS NOT NULL AND j.in_flight=0 AND "
                    + due_sql + ' ORDER BY j.next_at LIMIT 30', params)]
            for job in due:
                if self._stop.is_set() or deadline is not None and time.monotonic() >= deadline:
                    break
                self._run_job(job)
                processed += 1
            with store.connect() as db:
                db.execute('UPDATE users SET next_check_at=(SELECT MIN(next_at) FROM jobs WHERE jobs.user_id=users.id)'
                           + (' WHERE id=?' if user_id else ''), (user_id,) if user_id else ())
            # Form-only runs never send status emails or open mailboxes.
            return processed
        finally:
            self._lock.release()

    def _recover(self, stamp: str, user_id=None):
        cutoff = iso(parse(stamp) - dt.timedelta(minutes=3))
        with store.connect() as db:
            rows = [dict(r) for r in db.execute('SELECT * FROM jobs WHERE in_flight=1 AND claim_at<?'
                    + (' AND user_id=?' if user_id else ''), (cutoff, user_id) if user_id else (cutoff,))]
        for job in rows:
            if job['phase'] in adapters.MUTATING:
                self._finish(job, 'uncertain', 'blocked',
                             'An interrupted request may have been sent. It will not be resent automatically.')
            else:
                self._finish(job, job['phase'], 'queued', 'Retrying an interrupted check.', delay=60)

    def _run_job(self, job: dict):
        with store.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            user = db.execute("SELECT * FROM users WHERE id=? AND verified=1 AND status='active' "
                              'AND authorized_at IS NOT NULL', (job['user_id'],)).fetchone()
            if not user:
                return
            claimed = db.execute('UPDATE jobs SET in_flight=1,claim_at=? WHERE user_id=? AND site_id=? '
                                 'AND in_flight=0 AND phase=?',
                                 (iso(now()), job['user_id'], job['site_id'], job['phase'])).rowcount
        if not claimed:
            return
        user, site = dict(user), json.loads(job['site_json'])
        if job['phase'] == 'submit' and job.get('profile_fingerprint') != self._fingerprint(user):
            self._finish(job, 'scan', 'queued', 'Profile updated. Checking the match again before submitting.', delay=1)
            return
        if not self.demo and email_routes.handles(site):
            self._own_email_route(user, site, job)
            return
        if not self.demo and form_routes.handles(site):
            self._privacy_form_route(user, site, job)
            return
        if not self.demo and job['phase'] == 'confirm':
            self._finish(job, 'confirm', 'awaiting_confirmation',
                         'Open the broker email yourself and complete its verification, then choose I completed verification. The app does not read your inbox.')
            return
        if not self.demo and not adapters.configured():
            self._finish(job, 'integration', 'blocked', 'Browser automation is not connected. No request has been sent.')
            return
        if not self.demo and job['phase'] == 'scan' and not site['search_urls']:
            if 'city' in site.get('search_missing', []) or 'region' in site.get('search_missing', []) or 'region_name' in site.get('search_missing', []):
                with store.connect() as db:
                    self._question(db, user['id'], 'city', 'What city and state or region do you live in? This helps distinguish people with your name.')
                self._finish(job, 'clarification', 'needs_info', 'A city and region are needed to search this directory.')
            else:
                self._finish(job, 'blocked', 'blocked', 'This route cannot be searched using the information provided.')
            return
        payload = self._payload(user, site, job)
        if job['phase'] == 'submit' and payload['confirmation_recipient']:
            with store.connect() as db:
                db.execute('UPDATE jobs SET confirmation_address=? WHERE user_id=? AND site_id=?',
                           (payload['confirmation_recipient'], user['id'], site['id']))
        if job['phase'] in ('submit', 'followup'):
            if 'id_upload' in site.get('requires', []):
                self._email_route(user, site, job, id_required=True)
                return
            if site.get('method') in ('email', 'legal_request'):
                self._email_route(user, site, job)
                return
            missing = set(site.get('fields_needed', [])) - set(payload['fields'])
            if missing:
                self._finish(job, 'blocked', 'blocked', 'This form requires information outside your supplied details. No extra data was sent.')
                return
        try:
            result = adapters.demo_invoke(payload) if self.demo else adapters.invoke(payload)
        except adapters.AdapterError:
            if job['phase'] in adapters.MUTATING:
                self._finish(job, 'uncertain', 'blocked', 'The request outcome is unknown. Automatic resending is paused to avoid duplicates.')
            else:
                self._retry(job, 'The site could not be checked. No removal has been recorded.')
            return
        self._result(user, site, job, result)

    def _payload(self, user, site, job):
        with store.connect() as db:
            item = db.execute('SELECT url FROM items WHERE user_id=? AND site_id=?',
                              (user['id'], site['id'])).fetchone()
        listing = item['url'] if item else None
        person = {k: user.get(k) for k in ('name', 'age', 'email', 'country', 'region', 'city')}
        confirmation_recipient = None
        available = {'full_name': user['name'], 'name': user['name'], 'email': user['email'],
                     'listing_url': listing, 'city': user.get('city'), 'region': user.get('region'),
                     'country': user.get('country'), 'age': user['age']}
        fields = {f: available[f] for f in site.get('fields_needed', []) if f in available and available[f] is not None}
        return {'version': 1, 'action': job['phase'], 'request_id': job['request_id'], 'site': site,
                'person': person, 'listing_url': listing, 'fields': fields, 'submitted_at': job['submitted_at'],
                'confirmation_ref': job['confirmation_ref'], 'confirmation_recipient': confirmation_recipient}

    def _result(self, user, site, job, result):
        status, phase = result.get('status'), job['phase']
        if phase == 'scan':
            with store.connect() as db:
                latest = db.execute('SELECT * FROM users WHERE id=?', (user['id'],)).fetchone()
            if latest is None:
                return
            if self._fingerprint(dict(latest)) != self._fingerprint(user):
                self._finish(job, 'scan', 'queued', 'Profile changed during the search. Checking again.', delay=1)
                return
        if status in ('captcha', 'id_required', 'unsupported'):
            if status == 'id_required':
                self._email_route(user, site, job, id_required=True)
            else:
                self._finish(job, 'blocked', 'blocked', MESSAGES[status])
            return
        if status == 'pending' and phase == 'confirm':
            self._retry(job, 'Waiting for the removal confirmation email.', status='awaiting_confirmation', delay=3600)
            return
        if phase in ('scan', 'check') and status == 'found':
            url = result.get('listing_url')
            if not adapters.allowed_url(url, site['domain']) or not adapters.same_person(user, result.get('match')):
                with store.connect() as db:
                    self._question(db, user['id'], 'city', 'Please confirm your city and region. A possible listing needs a stronger match.')
                self._finish(job, 'clarification', 'needs_info', 'A possible match needs more evidence. No request was sent.')
                return
            if phase == 'check':
                if not job['last_verified_removed']:
                    if not job['followup_sent'] and now() >= parse(job['submitted_at']) + dt.timedelta(days=45):
                        self._finish(job, 'followup', 'requested', 'The listing remains. A follow-up is queued.', delay=1)
                    else:
                        self._schedule_check(job, 'requested', 'The listing is still visible. The request remains open.')
                    return
                if job['cycles'] >= 3:
                    self._finish(job, 'blocked', 'blocked', 'The listing returned repeatedly. Automatic retry limit reached.')
                    return
            self._finish(job, 'submit', 'found', 'A matching listing was found. Removal is queued.', delay=2,
                         url=url, matched=1, profile_fingerprint=self._fingerprint(user), confirmation_address=None if phase == 'check' else job.get('confirmation_address'),
                         request_id=uuid.uuid4().hex if phase == 'check' else job['request_id'])
            return
        if phase == 'scan' and status == 'not_found':
            self._finish(job, 'scan', 'not_found', 'No matching public listing was found.', delay=30 * DAY)
            return
        if phase == 'check' and status == 'removed' and result.get('verified_absent') is True:
            self._schedule_check(job, 'removed', 'Removal verified: the listing is no longer publicly available.')
            return
        if phase in ('submit', 'followup') and status in ('requested', 'awaiting_confirmation'):
            if result.get('request_id') != job['request_id'] or result.get('route_verified') is not True:
                self._finish(job, 'uncertain', 'blocked', 'The submission could not be verified. Automatic resending is paused.')
                return
            stamp = iso(now())
            self._finish(job, 'confirm' if status == 'awaiting_confirmation' else 'check', status,
                         ('Request sent. Open the broker email yourself to complete verification.'
                          if status == 'awaiting_confirmation' else 'Removal request sent. Verification will follow.'),
                         delay=2 if self.demo else (None if status == 'awaiting_confirmation' else max(1, site.get('expected_days') or 7) * DAY),
                         first_submitted_at=job['first_submitted_at'] or stamp,
                         submitted_at=job['submitted_at'] if phase == 'followup' else stamp,
                         confirmation_ref=str(result.get('confirmation_ref') or '')[:500],
                         cycles=job['cycles'] + (phase == 'submit'), followup_sent=int(phase == 'followup'), last_verified_removed=0)
            return
        if phase == 'confirm' and status == 'confirmed' and self._confirmation_valid(site, job, result):
            self._finish(job, 'check', 'requested', 'Confirmation processed. Waiting to verify the listing is gone.',
                         delay=2 if self.demo else max(1, site.get('expected_days') or 7) * DAY)
            return
        if phase in adapters.MUTATING:
            self._finish(job, 'uncertain', 'blocked', 'The request outcome could not be verified. No automatic repeat will be sent.')
        elif status == 'ambiguous':
            with store.connect() as db:
                self._question(db, user['id'], 'city', 'Please confirm your city and region. A possible listing needs a stronger match.')
            self._finish(job, 'clarification', 'needs_info', 'A possible match needs more evidence. No request was sent.')
        else:
            self._retry(job, 'The site did not provide a usable result. No removal has been recorded.')

    @staticmethod
    def _confirmation_valid(site, job, result):
        try:
            return (result.get('request_id') == job['request_id'] and result.get('authenticated') is True
                    and result.get('purpose') == 'removal'
                    and adapters.allowed_url(result.get('confirmation_url'), site['domain'])
                    and (result.get('sender_domain') or '').lower() == site['domain'].lower()
                    and parse(result['received_at']) >= parse(job['submitted_at'])
                    and parse(result['received_at']) <= now() + dt.timedelta(minutes=5))
        except (ValueError, KeyError, TypeError):
            return False

    def _email_route(self, user, site, job, id_required=False):
        self._finish(job, 'blocked', 'blocked',
                     'Email sending is disabled. This app uses your supplied email only in broker forms.')

    def _own_email_route(self, user, site, job):
        # Also stop historical or manually injected jobs. No mailbox is opened,
        # and no SMTP fallback can be activated by environment credentials.
        self._finish(job, 'blocked', 'blocked',
                     'Email sending is disabled. Any earlier request remains unverified; no repeat was sent.')

    def _privacy_form_route(self, user, site, job):
        if not form_routes.valid(site):
            self._finish(job, 'blocked', 'blocked', 'This privacy portal route is not supported.')
            return
        if job.get('form_started_at'):
            self._finish(job, 'broker_step', 'needs_broker_step',
                         'The broker sent a verification email. Open it yourself and finish the broker portal. No completed removal has been established.',
                         url=site['optout_url'])
            return
        if not adapters.configured():
            self._finish(job, 'integration', 'blocked', 'Browser automation is not connected. No request has been sent.')
            return
        if job['phase'] == 'scan':
            self._finish(job, 'submit', 'queued',
                         'The privacy portal can start verification using your supplied email. No public listing has been established.',
                         delay=2, matched=0, profile_fingerprint=self._fingerprint(user))
            return
        if job['phase'] != 'submit':
            self._finish(job, 'blocked', 'blocked', 'No privacy portal action is queued.')
            return
        try:
            result = adapters.invoke(self._payload(user, site, job))
        except adapters.AdapterError:
            self._finish(job, 'uncertain', 'blocked', 'The portal outcome is unknown. No repeat will be sent automatically.')
            return
        if (result.get('status') == 'verification_sent' and result.get('route_verified') is True
                and result.get('request_id') == job['request_id']):
            self._finish(job, 'broker_step', 'needs_broker_step',
                         'The broker sent a verification email. Open it yourself and finish the broker portal. A removal request is not yet confirmed.',
                         url=site['optout_url'], form_started_at=iso(now()), matched=0, last_verified_removed=0)
        elif result.get('status') in ('unsupported', 'captcha', 'id_required'):
            self._finish(job, 'blocked', 'blocked', MESSAGES[result['status']])
        else:
            self._finish(job, 'uncertain', 'blocked', 'The portal outcome could not be verified. No repeat will be sent automatically.')

    def confirmation_completed(self, user_id: str, site_id: str) -> bool:
        """Record the user's own report; only a later broker check proves absence."""
        with store.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            portal = db.execute("SELECT j.* FROM jobs j JOIN users u ON u.id=j.user_id "
                                "WHERE j.user_id=? AND j.site_id=? AND j.phase='broker_step' AND j.in_flight=0 "
                                "AND j.form_started_at IS NOT NULL AND u.status='active' "
                                "AND u.authorized_at IS NOT NULL AND u.authorized_at<>''",
                                (user_id, site_id)).fetchone()
            if portal and form_routes.valid(json.loads(portal['site_json'])):
                db.execute("UPDATE jobs SET phase='done',next_at=NULL WHERE user_id=? AND site_id=?", (user_id, site_id))
                db.execute("UPDATE items SET status='unverified',detail=?,updated_at=? WHERE user_id=? AND site_id=?",
                           ('You reported completing the broker steps. Deletion has not been independently verified.',
                            iso(now()), user_id, site_id))
                store.event(db, user_id, 'You reported completing the broker portal. Deletion remains unverified.')
                return True
            job = db.execute("SELECT j.* FROM jobs j JOIN users u ON u.id=j.user_id "
                             "WHERE j.user_id=? AND j.site_id=? AND j.phase='confirm' AND j.in_flight=0 "
                             "AND j.first_submitted_at IS NOT NULL AND j.submitted_at IS NOT NULL "
                             "AND u.status='active' AND u.authorized_at IS NOT NULL AND u.authorized_at<>''",
                             (user_id, site_id)).fetchone()
            if not job:
                return False
            try:
                if parse(job['submitted_at']) > now() + dt.timedelta(minutes=5):
                    return False
            except (ValueError, TypeError):
                return False
            db.execute("UPDATE jobs SET phase='check',next_at=?,attempts=0 WHERE user_id=? AND site_id=?",
                       (iso(now()), user_id, site_id))
            db.execute("UPDATE items SET status='requested',detail=?,updated_at=? WHERE user_id=? AND site_id=?",
                       ('You reported completing email verification. A separate broker check is required to verify removal.',
                        iso(now()), user_id, site_id))
            store.event(db, user_id, 'You reported completing broker email verification. Removal has not yet been verified.')
        return True

    def _retry(self, job, detail, status='blocked', delay=3600):
        attempts = job['attempts'] + 1
        if attempts >= (24 if job['phase'] == 'confirm' else 3):
            self._finish(job, 'blocked', 'blocked', detail + ' Retry limit reached.', attempts=attempts)
        else:
            self._finish(job, job['phase'], status, detail, delay=delay * attempts, attempts=attempts)

    def _schedule_check(self, job, status, detail):
        origin = parse(job['first_submitted_at'])
        upcoming = [origin + dt.timedelta(days=d) for d in (30, 45, 90) if origin + dt.timedelta(days=d) > now()]
        if upcoming:
            self._finish(job, 'check', status, detail, delay=max(1, (upcoming[0] - now()).total_seconds()),
                         last_verified_removed=int(status == 'removed'))
        else:
            self._finish(job, 'done', status, detail + ' The 90-day monitoring period is complete.',
                         last_verified_removed=int(status == 'removed'))

    def _finish(self, job, phase, status, detail, *, delay=None, url=None, **updates):
        stamp = iso(now())
        next_at = iso(now() + dt.timedelta(seconds=delay)) if delay is not None else None
        changes = dict(phase=phase, next_at=next_at, in_flight=0, claim_at=None, attempts=0, **{})
        changes.update(updates)
        allowed = {'phase', 'next_at', 'in_flight', 'claim_at', 'attempts', 'request_id', 'matched',
                   'first_submitted_at', 'submitted_at', 'confirmation_ref', 'confirmation_address', 'profile_fingerprint', 'cycles', 'followup_sent', 'last_verified_removed', 'form_started_at'}
        if not set(changes).issubset(allowed):
            raise ValueError('Unexpected worker state field.')
        with store.connect() as db:
            if not db.execute('SELECT 1 FROM users WHERE id=?', (job['user_id'],)).fetchone():
                return
            before = db.execute('SELECT status,detail FROM items WHERE user_id=? AND site_id=?',
                                (job['user_id'], job['site_id'])).fetchone()
            db.execute('UPDATE jobs SET ' + ','.join(k + '=?' for k in changes) + ' WHERE user_id=? AND site_id=?',
                       (*changes.values(), job['user_id'], job['site_id']))
            db.execute('UPDATE items SET status=?,detail=?,url=COALESCE(?,url),updated_at=? WHERE user_id=? AND site_id=?',
                       (status, detail, url, stamp, job['user_id'], job['site_id']))
            if before and (before['status'] != status or before['detail'] != detail):
                name = json.loads(job['site_json'])['name']
                store.event(db, job['user_id'], f'{name}: {detail}')
