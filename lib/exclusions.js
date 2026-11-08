/* Libre Translate Page — logique pure : exclusion de sites.
   UMD : export Node (module.exports) pour les tests, et global browser
   (globalThis.LtpExclusions) pour le background / les content scripts.
   Aucune dépendance au DOM ni à l'API navigateur -> 100 % testable. */
(function (global) {
  'use strict';

  // Normalise une URL ou un hostname en hostname minuscule.
  //  "https://Www.Exemple.com/Path?x=1" -> "exemple.com"
  //  "exemple.com"                       -> "exemple.com"
  function normalizeHost(input) {
    if (!input) return '';
    let s = String(input).trim();
    if (!s) return '';
    if (!/^https?:\/\//i.test(s)) s = 'http://' + s;
    let host = '';
    try {
      host = new URL(s).hostname;
    } catch (e) {
      host = s.replace(/^https?:\/\//i, '').split('/')[0];
    }
    return host.toLowerCase();
  }

  // Valeur stockée : nom de domaine sans "www.", en minuscules.
  function toEntry(hostname) {
    let h = normalizeHost(hostname);
    if (h.indexOf('www.') === 0) h = h.slice(4);
    return h;
  }

  // Vrai si le hostname est exclu : égal à une entrée OU sous-domaine d'une entrée.
  function isExcluded(hostname, entries) {
    const h = normalizeHost(hostname);
    if (!h || !Array.isArray(entries)) return false;
    for (let i = 0; i < entries.length; i++) {
      const e = toEntry(entries[i]);
      if (!e) continue;
      if (h === e) return true;
      if (h.slice(-(e.length + 1)) === '.' + e) return true; // sous-domaine
    }
    return false;
  }

  // Ajoute l'entrée (idempotent). Renvoie un nouveau tableau.
  function addExclusion(entries, hostname) {
    const base = Array.isArray(entries) ? entries.slice() : [];
    const e = toEntry(hostname);
    if (!e) return base;
    if (base.some((x) => toEntry(x) === e)) return base;
    base.push(e);
    return base;
  }

  // Retire l'entrée. Renvoie un nouveau tableau.
  function removeExclusion(entries, hostname) {
    const base = Array.isArray(entries) ? entries.slice() : [];
    const e = toEntry(hostname);
    return base.filter((x) => toEntry(x) !== e);
  }

  // Liste propre (sans www, triée) pour l'affichage.
  function listEntries(entries) {
    return (Array.isArray(entries) ? entries : [])
      .map(toEntry)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  }

  const api = {
    normalizeHost,
    toEntry,
    isExcluded,
    addExclusion,
    removeExclusion,
    listEntries
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.LtpExclusions = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
