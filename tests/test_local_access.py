import pytest

from webapp import adapters, auth, store
from local_access import issue


def test_local_identity_is_not_verified_email(tmp_path):
    store.init_db(tmp_path / 'local', mode='local')
    token = auth.local_signup('Example Person', 28, 'person@example.test')
    user = auth.session_user(token)
    assert user['verification_method'] == 'self_attested_local'
    assert not adapters.same_person(user, {'name': user['name'], 'email': user['email']})
    with pytest.raises(auth.AuthError):
        auth.local_signup('Other Person', 30, user['email'])


def test_local_recovery_requires_existing_private_local_database(tmp_path):
    folder = tmp_path / 'local'
    with pytest.raises(ValueError):
        issue(folder)
    assert not folder.exists()
    store.init_db(folder, mode='local')
    original = auth.local_signup('Example Person', 28, 'person@example.test')
    token = issue(folder)
    assert auth.session_user(original)['id'] == auth.session_user(token)['id']
    assert original != token
    folder.chmod(0o755)
    with pytest.raises(ValueError):
        issue(folder)


def test_recovery_cannot_adopt_demo_or_email_verified_profile(tmp_path):
    folder = tmp_path / 'demo'
    store.init_db(folder, mode='demo')
    with pytest.raises(ValueError):
        issue(folder)


def test_recovery_ambiguous_profiles_require_exact_email(tmp_path):
    folder = tmp_path / 'local'
    store.init_db(folder, mode='local')
    auth.local_signup('Example One', 28, 'one@example.test')
    auth.local_signup('Example Two', 29, 'two@example.test')
    with pytest.raises(ValueError):
        issue(folder)
    assert auth.session_user(issue(folder, 'two@example.test'))['name'] == 'Example Two'
