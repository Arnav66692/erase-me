#!/usr/bin/env python3
"""Guide one local, removal-only Gmail connection and companion installation.

Run this command explicitly in your own Terminal. It never asks for a password,
reads Gmail messages, submits a broker form or installs scheduled work.
"""
from __future__ import annotations

import argparse
import hmac
import os
from pathlib import Path
import stat

import connect_removal_gmail as oauth
import install_mail_host as installer


class SetupError(Exception):
    """Only fixed, non-secret guidance is shown to the user."""


def matching_connection(data: dict, primary_hash: str, mailbox: str) -> bool:
    return (hmac.compare_digest(data['personal_email_sha256'], primary_hash)
            and oauth.private.canonical_email(data['mailbox']) == oauth.private.canonical_email(mailbox))


def answer(prompt, question: str, *, maximum: int = 1024) -> str:
    value = prompt(question)
    if (not isinstance(value, str) or len(value) > maximum
            or any(ord(c) < 32 or ord(c) == 127 for c in value)):
        raise SetupError('An answer was not valid plain text. Start setup again when ready.')
    value = value.strip()
    if not value:
        raise SetupError('Setup was not completed. No later step was started.')
    return value


def confirm(prompt, question: str) -> None:
    if answer(prompt, question, maximum=8).casefold() not in {'y', 'yes'}:
        raise SetupError('Setup was cancelled. No later step was started.')


def client_file(value: str, *, prompt, emit) -> dict:
    # A path is data, never a shell command. Permit the quotes added when copying
    # a path containing spaces; do not expand environment variables or shell text.
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
        value = value[1:-1]
    path = oauth._path(Path(value))
    try:
        info = path.lstat()
        if (not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid()
                or info.st_nlink != 1 or info.st_size > oauth.MAX_RESPONSE):
            raise ValueError()
        if stat.S_IMODE(info.st_mode) & 0o077:
            emit('The selected client file needs owner-only permissions.')
            confirm(prompt, 'Make that selected file private now? [y/N]: ')
            descriptor = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
            try:
                opened = os.fstat(descriptor)
                if ((opened.st_dev, opened.st_ino) != (info.st_dev, info.st_ino)
                        or not stat.S_ISREG(opened.st_mode) or opened.st_uid != os.getuid()
                        or opened.st_nlink != 1):
                    raise ValueError()
                os.fchmod(descriptor, 0o600)
            finally:
                os.close(descriptor)
        return oauth.load_client(path)
    except (OSError, ValueError, oauth.OAuthError):
        raise SetupError('Select your own Google Desktop client JSON outside the checkout, without links. No Google connection was started.') from None


def run_setup(*, extension_id=None, browser='chrome', reconnect=False, check_only=False,
              prompt=None, emit=None, home=None, config_path=None, platform=None) -> dict:
    """Dependencies and private paths are injectable so tests touch only fixtures."""
    prompt = input if prompt is None else prompt
    emit = print if emit is None else emit
    emit('Erase Me removal-only email setup. Keep passwords and verification codes out of Terminal and chat.')
    emit('Use a separate account containing only removal mail. This command reads no Gmail messages and starts no timers.')
    personal = answer(prompt, 'Primary email used in your Erase Me profile: ', maximum=254)
    try:
        primary_hash = oauth.private.personal_digest(personal)
    except ValueError:
        raise SetupError('Enter the valid primary email used in your Erase Me profile. It will not be connected.') from None
    mailbox = answer(prompt, 'Separate removal-only Gmail address: ', maximum=254)
    try:
        mailbox = oauth.validate_mailbox(mailbox, personal)
    except oauth.OAuthError:
        raise SetupError('Use a separate, untagged Gmail account. Your personal address and its aliases cannot be connected.') from None
    confirm(prompt, 'Does this separate account contain only removal-related mail? [y/N]: ')
    extension = (answer(prompt, 'Erase Me companion ID from chrome://extensions: ', maximum=32)
                 if extension_id is None else extension_id)
    try:
        spec = installer.plan(extension, browser=browser, platform=platform, home=home)
        installed = installer.check(spec)['installed']
        wrapper = Path(spec['wrapper_path'])
        installer.files._no_symlinks(wrapper)
        if wrapper.exists():
            installer.files._regular(wrapper)
        # Refuse unrelated registrations or unsafe installation paths before any
        # OAuth provider call. Existing recognized installations require approval
        # to change; a matching current installation is reused without rewriting.
        replacement = bool(installer._manifest(spec) is not None
                           or installer._registration(spec) is not None
                           or wrapper.exists()) and not installed
    except (ValueError, OSError, installer.host.MailHostError):
        raise SetupError('Check the companion ID and use macOS Chrome or Linux Chrome/Chromium with private installation paths.') from None
    if replacement and not check_only:
        confirm(prompt, 'Update the existing local connector registration for this companion? [y/N]: ')
    path = oauth._path(oauth.default_config() if config_path is None else Path(config_path))
    if path.name != oauth.TOKEN_FILE:
        raise SetupError('Use the dedicated gmail-oauth.json token file outside the checkout.')
    existing = path.exists() or path.is_symlink()
    if check_only and not existing:
        raise SetupError('No saved removal-only connection exists. Run setup without --check first.')
    if existing and not reconnect:
        saved = oauth.load_config(path)
        if not matching_connection(saved, primary_hash, mailbox):
            raise SetupError('The saved connection belongs to a different profile or mailbox. Nothing was changed. Use --reconnect only for an intentional new authorization.')
        # The existing helper refreshes only if needed and verifies provider identity.
        # It calls no Gmail messages endpoint and never returns credentials to CLI.
        emit('Checking the saved dedicated Google identity; no messages will be read.')
        checked = oauth.check_token(path)
        if not matching_connection(checked, primary_hash, mailbox):
            raise SetupError('The saved connection changed during its identity check. No companion installation was started. Run setup again for the intended profile and dedicated account.')
        reused = True
    elif not check_only:
        # Preflight the same guarded destination used by the original OAuth CLI.
        # Do this before consent, not after obtaining a new grant.
        oauth.private.safe_directory(path.parent, create=True)
        if existing:
            oauth.private._regular(path)
        client = client_file(answer(prompt, 'Private Google Desktop client JSON path: '), prompt=prompt, emit=emit)
        emit('Opening Google consent. Select only the separate removal account; Google may require its own login checks.')
        connected = oauth.connect(mailbox, personal, client)
        try:
            oauth.save_config(path, connected, replace=reconnect)
        except (oauth.OAuthError, ValueError, OSError):
            oauth.revoke(connected['tokens'])
            raise SetupError('The new Google grant could not be saved privately and was submitted for revocation. Retry setup after checking the private directory.') from None
        reused = False
    else:
        raise SetupError('Use --reconnect without --check to authorize a different dedicated account.')
    try:
        if not installed and not check_only:
            emit('Dedicated identity is ready. Installing the on-demand companion connector.')
            installer.install(spec, replace=replacement)
        ready = installer.check(spec)['installed']
    except (ValueError, OSError, installer.host.MailHostError):
        raise SetupError('The dedicated mailbox is connected, but local connector installation did not finish. Check the private installation paths and run setup again.') from None
    if not ready:
        raise SetupError('The dedicated mailbox is connected, but the companion registration needs setup. Run this command again without --check.')
    emit('Ready. In Erase Me choose “Connect my removal-only mailbox” and enable local connectors in the companion.')
    emit('No Gmail messages were read, broker requests submitted or timers installed by setup.')
    return {'ok': True, 'installed': True, 'reused_connection': reused,
            'identity_checked': True, 'messages_read': False, 'scheduled_work': False}


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--extension-id', help='Optional 32-letter companion ID; otherwise asked locally.')
    parser.add_argument('--browser', choices=('chrome', 'chromium'), default='chrome')
    actions = parser.add_mutually_exclusive_group()
    actions.add_argument('--check', action='store_true', help='Check an existing connection and registration; do not install either.')
    actions.add_argument('--reconnect', action='store_true', help='Explicitly replace saved OAuth credentials through fresh Google consent.')
    args = parser.parse_args(argv)
    try:
        run_setup(extension_id=args.extension_id, browser=args.browser,
                  reconnect=args.reconnect, check_only=args.check)
        return 0
    except SetupError as error:
        print(str(error))
        return 1
    except (oauth.OAuthError, ValueError, OSError, installer.host.MailHostError):
        print('Setup did not finish. Check the separate account, private Desktop client file, companion ID and Google consent. No provider response or credentials were logged.')
        return 1
    except (KeyboardInterrupt, EOFError):
        print('\nSetup cancelled. No timers were started.')
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
