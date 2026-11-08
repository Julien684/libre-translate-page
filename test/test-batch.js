'use strict';
const { assert, assertEq, suite } = require('./harness');
const B = require('../lib/batch');

suite('batch — alignTranslations (non-régression)', () => {
  assertEq(B.alignTranslations('a\nb\nc', ['x', 'y', 'z']), ['a', 'b', 'c'], 'alignement 1:1');
  assertEq(B.alignTranslations('a\nb\nc\nd', ['x', 'y', 'z']), null, 'désalignement -> null (fallback)');
  assertEq(B.alignTranslations('a\nb', ['x', 'y', 'z']), null, 'trop peu de lignes -> null');
  assertEq(B.alignTranslations('', ['x']), [''], '1 texte -> 1 ligne vide (cohérent, pas de désalignement)');
  assertEq(B.alignTranslations('', ['x', 'y']), null, 'vide pour 2 textes -> null');
  assert(B.alignTranslations('ok', null) === null, 'texts non-array -> null');
  assertEq(B.alignTranslations('un', ['x']), ['un'], '1 texte 1 ligne');
});
