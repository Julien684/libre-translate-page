'use strict';
const { assert, assertEq, suite } = require('./harness');
const E = require('../lib/exclusions');

suite('exclusions — normalizeHost (hostname, www CONSERVÉ — toEntry le retire)', () => {
  assertEq(E.normalizeHost('https://Www.Exemple.com/Path?x=1'), 'www.exemple.com', 'URL complète -> hostname minuscule (www conservé)');
  assertEq(E.normalizeHost('http://example.com:8080/foo'), 'example.com', 'le port est retiré');
  assertEq(E.normalizeHost('exemple.com'), 'exemple.com', 'bare hostname');
  assertEq(E.normalizeHost('  EXEMPLE.COM  '), 'exemple.com', 'trim + minuscules');
  assertEq(E.normalizeHost(''), '', 'vide');
  assertEq(E.normalizeHost(null), '', 'null');
});

suite('exclusions — toEntry (retire www)', () => {
  assertEq(E.toEntry('www.wikipedia.org'), 'wikipedia.org', 'www retiré');
  assertEq(E.toEntry('https://www.wikipedia.org/wiki'), 'wikipedia.org', 'www retiré sur URL');
  assertEq(E.toEntry('exemple.com'), 'exemple.com', 'sans www inchangé');
});

suite('exclusions — isExcluded (domaine + sous-domaine)', () => {
  const entries = ['wikipedia.org', 'example.com'];
  assert(E.isExcluded('wikipedia.org', entries), 'domaine exact');
  assert(E.isExcluded('www.wikipedia.org', entries), 'www du domaine exclu');
  assert(E.isExcluded('fr.wikipedia.org', entries), 'sous-domaine');
  assert(E.isExcluded('a.b.example.com', entries), 'sous-sous-domaine');
  assert(E.isExcluded('https://fr.wikipedia.org/wiki', entries), 'URL complète');
  assert(!E.isExcluded('evilwikipedia.org', entries), 'suffixe identique mais domaine différent');
  assert(!E.isExcluded('mywikipedia.org', entries), 'préfixe identique mais domaine différent');
  assert(!E.isExcluded('exemple.net', entries), 'domaine non exclu');
  assert(!E.isExcluded('', entries), 'vide');
  assert(!E.isExcluded('wikipedia.org', null), 'entries non-array');
});

suite('exclusions — add/remove (idempotent, immuable)', () => {
  let list = [];
  list = E.addExclusion(list, 'https://www.wikipedia.org/');
  assertEq(list, ['wikipedia.org'], 'ajout 1');
  list = E.addExclusion(list, 'wikipedia.org');
  assertEq(list, ['wikipedia.org'], 're-ajout idempotent');
  list = E.addExclusion(list, 'example.com');
  assertEq(list.length, 2, '2 entrées');
  const before = list;
  list = E.removeExclusion(list, 'wikipedia.org');
  assertEq(list, ['example.com'], 'retrait');
  assert(before.length === 2, 'le tableau original n\'a pas été muté');
  list = E.removeExclusion(list, 'inexistant.fr');
  assertEq(list, ['example.com'], 'retrait d\'inexistant = no-op');
});

suite('exclusions — listEntries', () => {
  assertEq(E.listEntries(['b.com', 'A.com', 'www.b.com']), ['a.com', 'b.com', 'b.com'], 'sans www, trié');
  assertEq(E.listEntries(null), [], 'null -> []');
});
