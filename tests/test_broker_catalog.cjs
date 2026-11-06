'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const routes = require('../webapp/static/broker-routes.js');
const referenceRoot = path.join(__dirname, '../skills/erase-me/references/countries');

test('catalog routes have unique IDs and exact HTTPS official entry hosts', () => {
  assert.equal(new Set(routes.map(route => route.id)).size, routes.length);
  for (const route of routes) {
    assert.match(route.id, /^[a-z0-9-]+$/);
    const url = new URL(route.url);
    assert.equal(url.protocol, 'https:'); assert.equal(url.username, ''); assert.equal(url.password, '');
    assert.equal(url.port, ''); assert.ok(route.allowedHosts.includes(url.hostname));
    assert.ok(route.countries.length); assert.ok(route.steps.length); assert.ok(route.evidence.length);
    assert.ok(Object.isFrozen(route)); assert.ok(Object.isFrozen(route.countries));
    assert.ok(Object.isFrozen(route.fields)); assert.ok(Object.isFrozen(route.allowedHosts));
  }
});
test('only reviewed standard initial actions have companion support', () => {
  assert.deepEqual(routes.filter(route => route.automationLevel === 'companion').map(route => route.id).sort(),
    ['peopledatalabs-form', 'usphonebook', 'searchpeoplefree', 'fastpeoplesearch', 'apollo', 'spokeo', 'advancedbackgroundchecks', 'smartbackgroundchecks', 'familytreenow', 'truepeoplesearch', 'whitepages',
      'tr-nosorgulama', 'tr-numaraara', 'tr-numarasor', 'tr-telefonsorgulama'].sort());
  assert.deepEqual(routes.filter(route => route.countries.includes('*')).map(route => route.id).sort(), ['apollo', 'peopledatalabs-form']);
  assert.deepEqual([...new Set(routes.flatMap(route => route.countries).filter(country => country !== '*'))].sort(), ['CA', 'DE', 'GB', 'TR', 'US']);
});
test('PeopleConnect group guidance is manual and never propagates coverage or completion', () => {
  const grouped=routes.filter(route=>route.manualGroup==='peopleconnect');
  assert.deepEqual(grouped.map(route=>route.id).sort(),['intelius','truthfinder','instantcheckmate','ussearch'].sort());
  for(const route of grouped){assert.equal(route.automationLevel,'manual');assert.equal(route.groupRouteId,'intelius');assert.deepEqual(route.covers,[]);}
  for(const id of ['addresses','zabasearch'])assert.equal(routes.find(route=>route.id===id).manualGroup,undefined);
});
test('the US reference catalog is fully represented as automation or explicit manual guidance', () => {
  const sourceIds = fs.readdirSync(path.join(referenceRoot, 'us')).filter(name => name.endsWith('.json')).map(name => JSON.parse(fs.readFileSync(path.join(referenceRoot, 'us', name), 'utf8')).id).sort();
  assert.deepEqual(routes.filter(route => route.countries.includes('US')).map(route => route.id).sort(), sourceIds);
});
test('regional references retain source provenance and only reviewed forms collect approved fields', () => {
  const promoted = new Set(['truepeoplesearch', 'familytreenow', 'advancedbackgroundchecks', 'tr-nosorgulama', 'tr-numaraara', 'tr-numarasor', 'tr-telefonsorgulama']);
  for (const route of routes.filter(route => route.sourceCatalog)) {
    if (route.id === 'whitepages') {
      assert.equal(route.automationLevel,'companion');assert.equal(route.availability,'reviewed_listing_prefill');
      assert.deepEqual(route.requiredAffirmations,['own_listing']);assert.deepEqual(route.fields,['listing_url']);
    } else if (promoted.has(route.id)) {
      assert.equal(route.automationLevel, 'companion');
      assert.equal(route.availability, 'reviewed_initial_form');
      assert.deepEqual(route.requiredAffirmations, ['own_request']);
      assert.ok(route.fields.every(field => ['first_name', 'last_name', 'full_name', 'email', 'phone', 'request_text'].includes(field)));
    } else {
      assert.equal(route.automationLevel, 'manual');
      assert.deepEqual(route.fields, []);
    }
    const source = JSON.parse(fs.readFileSync(path.join(referenceRoot, route.sourceCatalog), 'utf8'));
    assert.equal(route.referenceUrl || route.url, source.optout.url); assert.equal(route.id, source.id);
    assert.equal(source.optout.requires.includes('id_upload'), false);
    assert.notEqual(source.category, 'legal_route');
    assert.ok(route.review);
    assert.equal(route.review.requestAccepted, false);
    assert.equal(route.review.deletionVerified, false);
  }
});
test('all 37 formerly generic routes have immutable channel reviews without deletion claims', () => {
  const audited = routes.filter(route => route.review);
  assert.equal(audited.length, 37);
  for (const route of audited) {
    assert.ok(Object.isFrozen(route.review));
    assert.match(route.review.checkedAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(route.review.summary && route.review.limits);
    assert.equal(route.review.requestAccepted, false);
    assert.equal(route.review.deletionVerified, false);
    for (const source of route.review.sources) assert.equal(new URL(source).protocol, 'https:');
    if (route.privacyContact) {
      assert.ok(Object.isFrozen(route.privacyContact));
      assert.ok(['privacy', 'support'].includes(route.privacyContact.kind));
      assert.equal(new URL(route.privacyContact.source).protocol, 'https:');
    }
  }
  for (const id of ['ca-cma-do-not-mail', 'ca-dncl', 'gb-tps'])
    assert.match(routes.find(route => route.id === id).operationKind, /registration$/);
});
test('known paid and government-public-record routes are excluded', () => {
  for (const id of ['ca-phone-unlisted', 'gb-companies-house', 'gb-open-register', 'de-melderegister', 'tr-kvkk-request', 'de-das-oertliche', 'de-das-telefonbuch'])
    assert.equal(routes.some(route => route.id === id), false, id);
  for (const cc of ['CA', 'GB', 'DE', 'TR']) assert.ok(routes.some(route => route.countries.includes(cc)));
});
