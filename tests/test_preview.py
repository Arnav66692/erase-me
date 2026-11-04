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


def test_public_demo_rejects_personal_data(client):
    assert client('GET','/api/config')[1]['synthetic_only'] is True
    status,_=client('POST','/api/signup',{'name':'Other Person','age':45,'email':'other@example.com','authorized':True})
    assert status==400
    assert client('GET','/api/dashboard')[0]==401


def test_public_demo_full_flow(client):
    body={k:preview.PROFILE[k] for k in ('name','email','age')}
    assert client('POST','/api/signup',body)[0]==400
    body['authorized']=True
    assert client('POST','/api/signup',body)[1]['demo_code']==preview.CODE
    assert client('POST','/api/verify',{'email':body['email'],'code':'000000'})[0]==400
    assert client('POST','/api/verify',{'email':body['email'],'code':preview.CODE})[0]==200
    assert client('POST','/api/campaign',{'action':'run'})[0]==200
    dashboard=client('GET','/api/dashboard')[1]
    assert dashboard['counts']['removed']==2
    assert all(row['domain'].endswith('.example') for row in dashboard['items'])
    assert client('POST','/api/profile',{'city':'New city'})[0]==400
    assert client('POST','/api/campaign',{'action':'pause'})[0]==200
    assert client('GET','/api/dashboard')[1]['campaign']['status']=='paused'
    assert client('POST','/api/campaign',{'action':'resume'})[0]==200
    assert client('DELETE','/api/account')[0]==200
    assert client('GET','/api/dashboard')[0]==401


def test_malformed_cookie_cannot_crash_preview():
    # Defensive state normalization protects dashboard indexing.
    data=preview.dashboard({'start':preview.time.time(),'paused':True,'stage':0})
    assert data['counts']['found']==0
