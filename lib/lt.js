/* Libre Translate Page — logique pure : construction de la requête fetch.
   La clé API est mise en corps (`api_key`) ET en header (`Authorization`),
   pour couvrir toutes les configurations de serveur LibreTranslate. */
(function (global) {
  'use strict';

  function buildRequest(serverUrl, path, body, settings) {
    const s = settings || {};
    const base = String(serverUrl || '').replace(/\/+$/, '');
    const url = base + path;
    const headers = {};
    let payload = body;
    if (s.apiKey) {
      if (payload) payload = Object.assign({}, payload, { api_key: s.apiKey });
      headers['Authorization'] = 'Bearer ' + s.apiKey;
    }
    if (payload) headers['Content-Type'] = 'application/json';
    const options = {
      method: body ? 'POST' : 'GET',
      headers: headers
    };
    if (payload) options.body = JSON.stringify(payload);
    return { url: url, options: options };
  }

  const api = { buildRequest };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.LtpLt = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
