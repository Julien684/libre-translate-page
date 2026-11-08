'use strict';
const { assertEq, suite } = require('./harness');
const D = require('../lib/detect');

suite('detect — parseDetectResponse (non-régression)', () => {
  assertEq(D.parseDetectResponse([{ confidence: 0.9, language: 'en' }]), 'en', 'tableau LibreTranslate >= 2');
  assertEq(D.parseDetectResponse([{ language: 'de' }]), 'de', 'tableau sans confidence');
  assertEq(D.parseDetectResponse({ language: 'es' }), 'es', 'objet format ancien');
  assertEq(D.parseDetectResponse([]), null, 'tableau vide');
  assertEq(D.parseDetectResponse({}), null, 'objet sans language');
  assertEq(D.parseDetectResponse(null), null, 'null');
  assertEq(D.parseDetectResponse('en'), null, 'string (non objet)');
});
