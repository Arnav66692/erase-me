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
import gmail_app_mail as app_mail


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
              prompt=None, emit=None, home=None, config_path=None, platform=None,
              ensure_active=None, allow_sending=False, reuse_saved_client=False,
              connection_method='oauth', app_password=None) -> dict:
    """Dependencies and private paths are injectable so tests touch only fixtures."""
    prompt = input if prompt is None else prompt
    emit = print if emit is None else emit
    guard = (lambda _stage: None) if ensure_active is None else ensure_active
    if type(allow_sending) is not bool or type(reuse_saved_client) is not bool or reuse_saved_client and not (allow_sending and reconnect):
        raise SetupError('Choose the optional sending permission explicitly.')
    if (connection_method not in ('oauth', 'app_password')
            or connection_method == 'oauth' and app_password is not None
            or connection_method == 'app_password' and reuse_saved_client):
        raise SetupError('Choose one supported separate-account connection method.')
    fresh_grant = None
    activation_reserved = False

    def discard_fresh():
        nonlocal fresh_grant
        if fresh_grant is not None and not activation_reserved:
            fresh_grant = None
            # Google's revoke endpoint revokes the whole account/project grant,
            # including other clients and concurrent setups. Discard only this
            # invocation's unused local credential; preserve shared authorization.
            emit('The unused new OAuth credential was not activated. Google consent was not revoked because it may be shared with another connection.')

    def active(stage):
        try:
            guard(stage)
        except Exception:
            discard_fresh()
            raise
    emit('Erase Me removal-only email setup. Keep passwords and verification codes in the private setup screen or Google, never chat.')
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
    selection_snapshot = app_mail.connection_snapshot(path.parent)
    selected = selection_snapshot['selection']
    selected_provider = selected['provider'] if selected else 'gmail_oauth'
    if selected and selected_provider != ('gmail_oauth' if connection_method == 'oauth' else app_mail.PROVIDER) and not reconnect:
        raise SetupError('Switching connection methods requires intentionally replacing the saved authorization.')
    oauth_path = app_mail.oauth_config_path(path.parent, selected if selected_provider == 'gmail_oauth' else None)
    existing = oauth_path.exists() or oauth_path.is_symlink()
    connected_config = None
    staged_path = None
    saved_client = None
    if existing and reuse_saved_client:
        previous = oauth.load_config(oauth_path)
        if matching_connection(previous, primary_hash, mailbox):
            saved_client = dict(previous['client'])
    if connection_method == 'app_password':
        app_path = app_mail.config_path(path.parent, selected if selected_provider == app_mail.PROVIDER else None)
        app_exists = app_path.exists() or app_path.is_symlink()
        if existing and not selected and not reconnect:
            raise SetupError('Switching from Google consent requires intentionally replacing the saved authorization.')
        if app_exists and not reconnect:
            saved = app_mail.load_config(app_path)
            if not matching_connection(saved, primary_hash, mailbox):
                raise SetupError('This saved separate account belongs to another profile. Select intentional replacement to change it.')
            if app_password is not None and not hmac.compare_digest(app_mail.password(app_password), saved['app_password']):
                raise SetupError('A changed app password needs explicit connection replacement.')
            if allow_sending and not saved['allow_sending']:
                raise SetupError('Adding sending permission needs explicit connection replacement and review.')
            connected_config, reused = saved, True
        else:
            if check_only:
                raise SetupError('No saved app-password connection is available.')
            connected_config = app_mail.make_config(mailbox, personal, app_password, allow_sending=allow_sending)
            reused = False
        active('before_identity')
        app_mail.verify(connected_config)
        active('after_app_identity')
        if connected_config['allow_sending']:
            app_mail.verify(connected_config, sending=True)
            active('after_app_send_identity')
    elif check_only and not existing:
        raise SetupError('No saved removal-only connection exists. Run setup without --check first.')
    elif existing and not reconnect:
        saved = oauth.load_config(oauth_path)
        if not matching_connection(saved, primary_hash, mailbox):
            raise SetupError('The saved connection belongs to a different profile or mailbox. Nothing was changed. Use --reconnect only for an intentional new authorization.')
        if allow_sending and frozenset(saved.get('scopes', ())) != oauth.SEND_SCOPES:
            raise SetupError('Sending needs fresh Google consent. Select the explicit reconnect option and your Desktop client to add only that optional permission.')
        # The existing helper refreshes only if needed and verifies provider identity.
        # It calls no Gmail messages endpoint and never returns credentials to CLI.
        emit('Checking the saved dedicated Google identity; no messages will be read.')
        active('before_identity')
        checked = oauth.check_token(oauth_path, persist=False, revoke_on_failure=False)
        if not matching_connection(checked, primary_hash, mailbox):
            raise SetupError('The saved connection changed during its identity check. No companion installation was started. Run setup again for the intended profile and dedicated account.')
        reused = True
        connected_config = checked
    elif not check_only:
        # Preflight the same guarded destination used by the original OAuth CLI.
        # Do this before consent, not after obtaining a new grant.
        oauth.private.safe_directory(path.parent, create=True)
        if existing:
            oauth.private._regular(oauth_path)
        client = (saved_client if saved_client is not None else
                  client_file(answer(prompt, 'Private Google Desktop client JSON path: '), prompt=prompt, emit=emit))
        emit('Opening Google consent. Select only the separate removal account; Google may require its own login checks.')
        active('before_oauth')
        connected = oauth.connect(mailbox, personal, client, revoke_on_failure=False,
                                  **({'allow_sending': True} if allow_sending else {}))
        connected_config = connected
        fresh_grant = connected['tokens']
        active('after_oauth_identity')
        reused = False
    else:
        raise SetupError('Use --reconnect without --check to authorize a different dedicated account.')
    active('after_identity')
    try:
        if not installed and not check_only:
            emit('Dedicated identity is ready. Installing the on-demand companion connector.')
            active('before_install')
            installer.install(spec, replace=replacement)
        ready = installer.check(spec)['installed']
    except (ValueError, OSError, installer.host.MailHostError):
        discard_fresh()
        raise SetupError('The dedicated mailbox is connected, but local connector installation did not finish. Check the private installation paths and run setup again.') from None
    if not ready:
        discard_fresh()
        raise SetupError('The dedicated mailbox is connected, but the companion registration needs setup. Run this command again without --check.')
    if not check_only:
        active('before_provider_selection')

        def reserve_activation():
            nonlocal activation_reserved
            active('before_connection_activation')
            activation_reserved = True

        try:
            config_file = None
            if connection_method == 'app_password' and reused and app_mail.VERSIONED_CONFIG.fullmatch(app_path.name):
                config_file = app_path.name
            else:
                active('before_save')
                staged_path = app_mail.stage_config(path.parent, connected_config)
                config_file = staged_path.name
            # Close and this activation reservation share the setup-session lock.
            # Once reserved the selected connection may finish, as the UI reports.
            app_mail.select_config(path.parent, connected_config, config_file=config_file,
                expected_selection=selection_snapshot['digest'],
                before_commit=reserve_activation)
        except BaseException:
            try:
                if staged_path is not None:
                    app_mail.discard_staged(staged_path, connected_config)
            finally:
                discard_fresh()
            raise
    active('complete')
    emit('Ready. In Erase Me choose “Connect my removal-only mailbox” and enable local connectors in the companion.')
    emit('No Gmail messages were read, broker requests submitted or timers installed by setup.')
    return {'ok': True, 'installed': True, 'reused_connection': reused,
            'identity_checked': True, 'messages_read': False, 'scheduled_work': False}


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--extension-id', help='Optional 32-letter companion ID; otherwise asked locally.')
    parser.add_argument('--browser', choices=('chrome', 'chromium'), default='chrome')
    parser.add_argument('--allow-sending', action='store_true', help='Request optional Gmail sending permission through fresh consent.')
    actions = parser.add_mutually_exclusive_group()
    actions.add_argument('--check', action='store_true', help='Check an existing connection and registration; do not install either.')
    actions.add_argument('--reconnect', action='store_true', help='Explicitly replace saved OAuth credentials through fresh Google consent.')
    args = parser.parse_args(argv)
    try:
        run_setup(extension_id=args.extension_id, browser=args.browser,
                  reconnect=args.reconnect, check_only=args.check, allow_sending=args.allow_sending)
        return 0
    except SetupError as error:
        print(str(error))
        return 1
    except (oauth.OAuthError, app_mail.AppMailError, ValueError, OSError, installer.host.MailHostError):
        print('Setup did not finish. Check the separate account, private Desktop client file, companion ID and Google consent. No provider response or credentials were logged.')
        return 1
    except (KeyboardInterrupt, EOFError):
        print('\nSetup cancelled. No timers were started.')
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
