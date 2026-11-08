/* Point d'entrée des tests :  node test/run.js  (ou  npm test) */
'use strict';

const fs = require('fs');
const path = require('path');
const { summary } = require('./harness');

const dir = __dirname;
const files = fs.readdirSync(dir).filter((f) => /^test-.*\.js$/.test(f)).sort();

console.log('Fichiers de test :', files.join(', '));
for (const f of files) {
  try {
    require(path.join(dir, f));
  } catch (e) {
    console.error('  ✗ ' + f + ' load error: ' + e.stack);
  }
}
summary();
