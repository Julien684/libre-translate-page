/* Harnais de test minimal, sans dépendance (Node >= 16).
   Usage :  node test/run.js
   Chaque test/test-*.js fait `const { assert, assertEq, assertThrows, suite } = require('./harness');`
   `run.js` charge le harnais, tous les test-*.js, puis appelle summary(). */
'use strict';

let passed = 0;
let failed = 0;
const failures = [];

function assert(cond, msg) {
  if (cond) { passed++; }
  else {
    failed++;
    failures.push(msg || 'assertion failed');
    console.error('  ✗ ' + (msg || 'assertion failed'));
  }
}
function assertEq(actual, expected, msg) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { passed++; }
  else {
    failed++;
    const m = (msg ? msg + ' — ' : '') + 'expected ' + JSON.stringify(expected) + ' got ' + JSON.stringify(actual);
    failures.push(m);
    console.error('  ✗ ' + m);
  }
}
function assertThrows(fn, msg) {
  try { fn(); }
  catch (e) { passed++; return; }
  failed++;
  const m = (msg ? msg + ' — ' : '') + 'expected to throw, did not';
  failures.push(m);
  console.error('  ✗ ' + m);
}
function suite(name, fn) {
  console.log('\n# ' + name);
  fn();
}

// Compte le résultat final et quitte avec le bon code retour.
function summary() {
  console.log('\n========================================');
  console.log('Tests : ' + passed + ' réussis, ' + failed + ' échec(s)');
  if (failed > 0) {
    console.log('Échecs :');
    for (const f of failures) console.log('  - ' + f);
    process.exit(1);
  }
  console.log('✓ Tous les tests passent.');
}

module.exports = { assert, assertEq, assertThrows, suite, summary };
