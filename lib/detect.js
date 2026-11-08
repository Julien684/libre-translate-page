/* Libre Translate Page — logique pure : parse de la réponse /detect.
   LibreTranslate >= 2 renvoie un TABLEAU [{confidence, language}, ...].
   Le format ancien renvoyait un objet {language}. Les deux sont gérés. */
(function (global) {
  'use strict';

  function parseDetectResponse(data) {
    if (Array.isArray(data) && data.length && data[0] && data[0].language) {
      return String(data[0].language);
    }
    if (data && typeof data === 'object' && data.language) {
      return String(data.language);
    }
    return null;
  }

  const api = { parseDetectResponse };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.LtpDetect = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
