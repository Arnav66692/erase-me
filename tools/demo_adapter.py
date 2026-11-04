#!/usr/bin/env python3
"""Synthetic protocol fixture. Refuses real domains; never makes a network call."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from webapp.adapters import demo_invoke, demo_sites


def main():
    request = json.load(sys.stdin)
    sites = {site['id']: site for site in demo_sites()}
    selected = sites.get(request.get('site', {}).get('id'))
    if selected is None or request['site'].get('domain') != selected['domain']:
        raise ValueError('Only the four synthetic demo brokers are supported.')
    request['site'] = selected
    print(json.dumps(demo_invoke(request)))


if __name__ == '__main__':
    main()
