/* Libre Translate Page — logique pure : machine à états de la progression.
   - update(ratio) mémorise le dernier ratio ; à 100 % note completedAt.
   - percent() -> entier 0..100.
   - shouldHide(now) -> vrai si 100 % atteint depuis >= hideDelay ms.
   Clock injectable via `now` pour des tests déterministes. */
(function (global) {
  'use strict';

  function makeTracker(hideDelayMs) {
    const t = {
      hideDelayMs: hideDelayMs == null ? 3000 : hideDelayMs,
      ratio: 0,
      completedAt: null
    };
    t.update = function (ratio) {
      const r = Math.max(0, Math.min(1, Number(ratio) || 0));
      t.ratio = r;
      if (r >= 1 && t.completedAt == null) t.completedAt = Date.now();
      return t;
    };
    t.percent = function () { return Math.round(t.ratio * 100); };
    t.isComplete = function () { return t.ratio >= 1; };
    t.shouldHide = function (now) {
      const n = now == null ? Date.now() : now;
      return t.completedAt != null && (n - t.completedAt) >= t.hideDelayMs;
    };
    return t;
  }

  const api = { makeTracker };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.LtpProgress = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
