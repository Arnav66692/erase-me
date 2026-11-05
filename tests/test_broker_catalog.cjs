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
test('only the six reviewed initial actions have companion support', () => {
  assert.deepEqual(routes.filter(route => route.automationLevel === 'companion').map(route => route.id).sort(),
    ['peopledatalabs-form', 'usphonebook', 'searchpeoplefree', 'fastpeoplesearch', 'apollo', 'spokeo'].sort());
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
test('new regional references match source URLs and never collect extra personal fields', () => {
  for (const route of routes.filter(route => route.sourceCatalog)) {
    assert.equal(route.automationLevel, 'manual'); assert.equal(route.availability, 'unverified_current');
    assert.deepEqual(route.fields, []);
    const source = JSON.parse(fs.readFileSync(path.join(referenceRoot, route.sourceCatalog), 'utf8'));
    assert.equal(route.url, source.optout.url); assert.equal(route.id, source.id);
    assert.equal(source.optout.requires.includes('id_upload'), false);
    assert.notEqual(source.category, 'legal_route');
    assert.match(route.evidence, /not been validated/);
    assert.ok(route.steps.some(step => step.includes('No request is sent')));
  }
});
test('known paid and government-public-record routes are excluded', () => {
  for (const id of ['ca-phone-unlisted', 'gb-companies-house', 'gb-open-register', 'de-melderegister', 'tr-kvkk-request', 'de-das-oertliche', 'de-das-telefonbuch'])
    assert.equal(routes.some(route => route.id === id), false, id);
  for (const cc of ['CA', 'GB', 'DE', 'TR']) assert.ok(routes.some(route => route.countries.includes(cc)));
});
