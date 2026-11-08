'use strict';
const { assert, assertEq, suite } = require('./harness');
const L = require('../lib/lt');

suite('lt — buildRequest (non-régression)', () => {
  // sans clé : GET, pas de body
  let r = L.buildRequest('http://localhost:5000/', '/languages', null, { apiKey: '' });
  assertEq(r.url, 'http://localhost:5000/languages', 'URL sans slash double');
  assertEq(r.options.method, 'GET', 'GET sans body');
  assert(!('body' in r.options), 'pas de body en GET');

  // avec clé : POST + api_key dans le corps + header Bearer
  r = L.buildRequest('http://srv:5000', '/translate', { q: 'hi' }, { apiKey: 'KEY123' });
  assertEq(r.url, 'http://srv:5000/translate', 'URL avec clé');
  assertEq(r.options.method, 'POST', 'POST avec body');
  assertEq(r.options.headers['Authorization'], 'Bearer KEY123', 'header Bearer');
  assertEq(r.options.headers['Content-Type'], 'application/json', 'Content-Type json');
  const body = JSON.parse(r.options.body);
  assertEq(body.api_key, 'KEY123', 'api_key injecté dans le corps');
  assertEq(body.q, 'hi', 'body original conservé');

  // la clé n'est PAS injectée si pas de body (GET)
  r = L.buildRequest('http://srv:5000', '/languages', null, { apiKey: 'KEY123' });
  assertEq(r.options.method, 'GET', 'GET malgré la clé');
  assert(!('body' in r.options), 'pas de body -> pas de api_key dans le corps');
});
