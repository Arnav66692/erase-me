"""The public preview must never accept real signup data or call live services."""
import importlib.util
import json
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer
from pathlib import Path
import threading

import pytest

spec=importlib.util.spec_from_file_location('preview_api',Path(__file__).parents[1]/'preview/api/index.py')
preview=importlib.util.module_from_spec(spec)
spec.loader.exec_module(preview)


@pytest.fixture
def client():
    server=ThreadingHTTPServer(('127.0.0.1',0),preview.handler)
    thread=threading.Thread(target=server.serve_forever,daemon=True)
    thread.start()
    cookie=''
    def request(method,path,body=None):
        nonlocal cookie
        connection=HTTPConnection(*server.server_address)
        headers={'X-Erase-Me':'1','Cookie':cookie,'Content-Type':'application/json'}
        connection.request(method,path,body=json.dumps(body or {}),headers=headers)
        response=connection.getresponse()
        if response.getheader('Set-Cookie'):
            cookie=response.getheader('Set-Cookie').split(';')[0]
        result=response.status,json.loads(response.read())
        connection.close()
        return result
    yield request
    server.shutdown()
    server.server_close()
    thread.join()


def test_public_workspace_has_no_server_profile_or_synthetic_results(client):
    status, config = client('GET', '/api/config')
    assert status == 200 and config['browser_workspace'] is True
    assert config['synthetic_only'] is False and config['server_profiles'] is False
    assert config['inbox_connected'] is False and config['manual'] is True
    assert client('GET', '/api/dashboard')[0] == 410


def test_public_server_rejects_personal_writes_without_echoing_them(client):
    body = {'name': 'Example Person', 'email': 'person@example.test', 'age': 40}
    for path in ('/api/signup', '/api/profile', '/api/campaign', '/api/verify'):
        status, response = client('POST', path, body)
        assert status == 405
        assert body['email'] not in json.dumps(response)
    assert client('DELETE', '/api/account')[0] == 405
