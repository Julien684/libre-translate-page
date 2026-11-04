/* Libre Translate Page — content script : restauration de l'original */
'use strict';

(function () {
  if (!window.__ltpTranslated) return;
  window.__ltpTranslated = false;
  // Reload the page to restore its original text.
  window.location.reload();
})();
