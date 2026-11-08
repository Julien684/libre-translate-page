/* Libre Translate Page — logique pure : alignement des traductions par lot.
   On envoie un texte joint par "\n" ; on recoupe par "\n". Si le nombre de
   lignes ne correspond plus (un texte contenait une newline), on renvoie null
   et l'appelant bascule en traduction une par une. */
(function (global) {
  'use strict';

  function alignTranslations(translatedText, texts) {
    if (typeof translatedText !== 'string' || !Array.isArray(texts)) return null;
    const out = translatedText.split('\n');
    if (out.length !== texts.length) return null;
    return out;
  }

  const api = { alignTranslations };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.LtpBatch = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
