"""Private, rate-limited status digests with conservative delivery recovery."""
from __future__ import annotations

import time

from . import auth, store

SCHEMA = '''
CREATE TABLE IF NOT EXISTS notification_delivery (
 user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 cursor INTEGER NOT NULL DEFAULT 0,
 next_at REAL NOT NULL DEFAULT 0,
 state TEXT NOT NULL DEFAULT 'idle',
 claimed_cursor INTEGER,
 last_sent_at REAL
);
'''
QUIET_SECONDS = 60
MIN_INTERVAL = 24 * 3600


def initialize():
    with store.connect() as db:
        db.executescript(SCHEMA)


def deliver():
    """Called by the live worker. Demo runs never enter this function.

    Claim before SMTP: if the process dies or delivery is ambiguous, hold the
    notification instead of risking a duplicate on restart. No email bodies or
    address values are written to logs or delivery bookkeeping.
    """
    if not auth.email_configured():
        return
    stamp = time.time()
    with store.connect() as db:
        db.execute('INSERT OR IGNORE INTO notification_delivery(user_id) '
                   "SELECT id FROM users WHERE verified=1 AND status='active'")
        users = [dict(row) for row in db.execute(
            'SELECT u.id,u.email,n.cursor,n.next_at,n.last_sent_at FROM users u '
            'JOIN notification_delivery n ON u.id=n.user_id '
            "WHERE u.verified=1 AND u.status='active' AND n.state='idle'")]
    for user in users:
        with store.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            last = db.execute('SELECT MAX(id) FROM activity WHERE user_id=?', (user['id'],)).fetchone()[0]
            if not last or last <= user['cursor']:
                continue
            if not user['next_at']:
                earliest = max(stamp + QUIET_SECONDS, (user['last_sent_at'] or 0) + MIN_INTERVAL)
                db.execute('UPDATE notification_delivery SET next_at=? WHERE user_id=? AND next_at=0',
                           (earliest, user['id']))
                continue
            if stamp < user['next_at']:
                continue
            claimed = db.execute(
                "UPDATE notification_delivery SET state='sending',claimed_cursor=? "
                "WHERE user_id=? AND state='idle' AND cursor=? "
                "AND EXISTS(SELECT 1 FROM users WHERE id=notification_delivery.user_id "
                "AND verified=1 AND status='active')",
                (last, user['id'], user['cursor'])).rowcount
            if not claimed:
                continue
            counts = {row['status']: row['total'] for row in db.execute(
                'SELECT status,COUNT(*) AS total FROM items WHERE user_id=? GROUP BY status', (user['id'],))}
            questions = db.execute('SELECT COUNT(*) FROM questions WHERE user_id=?', (user['id'],)).fetchone()[0]
        lines = ['Your Erase Me status has changed.', '']
        for key, label in [('removed', 'Listings verified removed'), ('requested', 'Requests awaiting removal'),
                           ('awaiting_confirmation', 'Requests awaiting email confirmation'),
                           ('needs_info', 'Sites needing more information'), ('blocked', 'Sites currently blocked'),
                           ('not_found', 'Sites with no matching listing found')]:
            if counts.get(key):
                lines.append(f'{label}: {counts[key]}')
        if questions:
            lines.append('Open your Erase Me dashboard to answer the outstanding questions.')
        lines.extend(['', 'A sent request does not mean a listing has been removed.',
                      'Use your Erase Me dashboard for details. Pause your account to stop future updates.'])
        try:
            auth.send_mail(user['email'], 'Your Erase Me status update', '\n'.join(lines))
        except auth.AuthError:
            with store.connect() as db:
                db.execute("UPDATE notification_delivery SET state='uncertain' WHERE user_id=?", (user['id'],))
            continue
        with store.connect() as db:
            db.execute("UPDATE notification_delivery SET cursor=?,state='idle',next_at=0,"
                       'last_sent_at=?,claimed_cursor=NULL WHERE user_id=?', (last, stamp, user['id']))
