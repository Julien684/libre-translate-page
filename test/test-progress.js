'use strict';
const { assert, assertEq, suite } = require('./harness');
const P = require('../lib/progress');

suite('progress — machine à états', () => {
  const t = P.makeTracker(3000);

  // initial
  assertEq(t.percent(), 0, 'départ à 0%');
  assert(!t.isComplete(), 'pas terminé au départ');
  assert(!t.shouldHide(1000), 'pas de masquage avant 100%');

  // progression
  t.update(0.25);
  assertEq(t.percent(), 25, '25%');
  t.update(0.5);
  assertEq(t.percent(), 50, '50%');
  assert(!t.isComplete(), 'pas encore à 100%');

  // 100% : completedAt = Date.now() réel
  t.update(1.0);
  assertEq(t.percent(), 100, '100%');
  assert(t.isComplete(), 'terminé à 100%');

  // juste après 100% : pas encore masqué
  assert(!t.shouldHide(Date.now() + 1000), 'pas masqué juste après 100%');

  // après 3000 ms : masqué
  assert(t.shouldHide(Date.now() + 3001), 'masqué après le délai');

  // clamping
  const t2 = P.makeTracker();
  t2.update(1.7);
  assertEq(t2.percent(), 100, 'clamping au-dessus');
  t2.update(-0.5);
  assertEq(t2.percent(), 0, 'clamping en dessous');
  t2.update(NaN);
  assertEq(t2.percent(), 0, 'NaN -> 0');

  // délai surchargeable
  const t3 = P.makeTracker(500);
  t3.update(1.0);
  assert(!t3.shouldHide(Date.now() + 100), 'délai 500ms : pas masqué à 100ms');
  assert(t3.shouldHide(Date.now() + 501), 'délai 500ms : masqué à 501ms');

  // completedAt n'est pas ré-écrit après le premier 100%
  const t4 = P.makeTracker(3000);
  t4.update(1.0);
  const first = t4.completedAt;
  t4.update(1.0);
  assertEq(t4.completedAt, first, 'completedAt stable après le premier 100%');
});
