/* Libre Translate Page — background script (MV2, Firefox)
   Les modules lib/*.js sont chargés AVANT ce fichier (voir manifest.json) et
   exposent des globals : LtpExclusions, LtpDetect, LtpBatch, LtpLt, LtpProgress. */
'use strict';

const DEFAULTS = {
  serverUrl: 'https://libretranslate.com',
  apiKey: '',
  sourceLang: 'auto',
  targetLang: 'fr',
  autoBanner: true,
  autoTranslate: false,      // traduit automatiquement la page (hors sites exclus)
  excludedSites: []          // liste de domaines (sans www, minuscules)
};

/* ---------- settings ---------- */

function getSettings() {
  return new Promise((resolve) => {
    browser.storage.local.get(Object.keys(DEFAULTS), (stored) => {
      resolve(Object.assign({}, DEFAULTS, stored));
    });
  });
}

/* ---------- LibreTranslate API ---------- */

async function ltFetch(path, body, method) {
  const s = await getSettings();
  const { url, options } = LtpLt.buildRequest(s.serverUrl, path, body, s);
  let res;
  try {
    res = await fetch(url, options);
  } catch (e) {
    throw new Error('Impossible de joindre le serveur : ' + s.serverUrl);
  }
  let data = null;
  try { data = await res.json(); } catch (e) { /* non-JSON */ }
  if (!res.ok) {
    let msg = (data && (data.error || data.message)) || ('HTTP ' + res.status);
    throw new Error(msg);
  }
  return data;
}

/* Translate a batch of texts (joined by newlines, single request). */
async function translateBatch(texts, source, target) {
  const data = await ltFetch('/translate', {
    q: texts.join('\n'),
    source: source,
    target: target,
    format: 'text'
  });
  const out = LtpBatch.alignTranslations(String(data.translatedText || ''), texts);
  if (out) return out;

  /* Fallback: newline handling mismatch → translate one by one. */
  const fallback = [];
  for (const t of texts) {
    const r = await ltFetch('/translate', { q: t, source, target, format: 'text' });
    fallback.push(r.translatedText);
  }
  return fallback;
}

/* Traduit un texte unique (sélection) — pas d'alignement par lot, on renvoie
   directement le translatedText du serveur. */
async function translateSingleText(text) {
  const s = await getSettings();
  let source = s.sourceLang;
  if (source === 'auto') source = await detectLanguage(text.slice(0, 500));
  const data = await ltFetch('/translate', {
    q: text,
    source: source,
    target: s.targetLang,
    format: 'text'
  });
  return { translated: data.translatedText || '', source: source, target: s.targetLang };
}

async function detectLanguage(q) {
  try {
    const data = await ltFetch('/detect', { q });
    const lang = LtpDetect.parseDetectResponse(data);
    if (lang) return lang;
    throw new Error('réponse inattendue');
  } catch (e) {
    if (e instanceof TypeError) throw e;
    throw new Error('Le serveur ne supporte pas la détection automatique — choisissez une langue source dans les options.');
  }
}

/* ---------- exclusions de sites ---------- */

async function isSiteExcluded(hostname) {
  const s = await getSettings();
  return LtpExclusions.isExcluded(hostname, s.excludedSites);
}

async function addSiteExclusion(hostname) {
  const s = await getSettings();
  const excludedSites = LtpExclusions.addExclusion(s.excludedSites, hostname);
  await browser.storage.local.set({ excludedSites });
  return excludedSites;
}

async function removeSiteExclusion(hostname) {
  const s = await getSettings();
  const excludedSites = LtpExclusions.removeExclusion(s.excludedSites, hostname);
  await browser.storage.local.set({ excludedSites });
  return excludedSites;
}

/* ---------- icon / badge state ---------- */

async function setTabState(tabId, state) {
  try {
    if (state === 'translated') {
      await browser.browserAction.setIcon({ tabId, path: { 16: 'icons/icon-translated-16.png', 32: 'icons/icon-translated-32.png', 48: 'icons/icon-translated-48.png', 64: 'icons/icon-translated-64.png' } });
      await browser.browserAction.setBadgeText({ tabId, text: '✓' });
      await browser.browserAction.setBadgeBackgroundColor({ tabId, color: '#2fbf71' });
    } else {
      await browser.browserAction.setIcon({ tabId });
      await browser.browserAction.setBadgeText({ tabId, text: '' });
    }
  } catch (e) { /* tab closed, ignore */ }
}

async function setTabProgress(tabId, ratio) {
  try {
    await browser.browserAction.setBadgeText({ tabId, text: Math.round(ratio * 100) + '%' });
    await browser.browserAction.setBadgeBackgroundColor({ tabId, color: '#4f7cff' });
  } catch (e) { /* ignore */ }
}

/* Diffuse la progression aux deux clients possibles :
   - pages d'extension (popup) via runtime.sendMessage ;
   - content script (bandeau) de l'onglet via tabs.sendMessage
     (runtime.sendMessage n'y est pas délivré de façon fiable). */
function broadcastProgress(ratio, tabId) {
  const msg = { type: 'ltp-progress-broadcast', ratio: ratio, tabId: tabId };
  browser.runtime.sendMessage(msg).catch(() => {});
  if (tabId != null) {
    browser.tabs.sendMessage(tabId, { type: 'ltp-progress-broadcast', ratio: ratio }).catch(() => {});
  }
}

/* ---------- content script injection ---------- */

const pendingInjections = new Map(); /* tabId -> resolve */

function inject(tabId, action) {
  if (action === 'restore') {
    // restore.js fait juste recharger la page : il n'envoie pas de ltp-done,
    // on résout donc immédiatement après l'injection (sinon le popup reste
    // bloqué jusqu'au timeout).
    return browser.tabs
      .executeScript(tabId, { file: 'content/restore.js', runAt: 'document_idle' })
      .then(() => ({ ok: true }))
      .catch((e) => ({ ok: false, error: 'Injection impossible sur cette page (' + e + '). Pages protégées (pdf, addons.mozilla.org, about:…) non supportées.' }));
  }
  return new Promise((resolve) => {
    pendingInjections.set(tabId, resolve);
    const timeout = setTimeout(() => {
      if (pendingInjections.has(tabId)) {
        pendingInjections.delete(tabId);
        resolve({ ok: false, error: 'Délai dépassé (timeout) pendant la traduction.' });
      }
    }, 120000);

    browser.tabs
      .executeScript(tabId, { file: 'content/translate.js', runAt: 'document_idle' })
      .catch((e) => {
        clearTimeout(timeout);
        pendingInjections.delete(tabId);
        resolve({ ok: false, error: 'Injection impossible sur cette page (' + e + '). Pages protégées (pdf, addons.mozilla.org, about:…) non supportées.' });
      });
  });
}

/* ---------- message router ---------- */

browser.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    const tabId = sender.tab ? sender.tab.id : null;

    switch (msg.type) {
      /* popup → inject script into active tab */
      case 'ltp-inject': {
        const result = await inject(msg.tabId, msg.action);
        if (result.ok && msg.action === 'translate') await setTabState(msg.tabId, 'translated');
        if (result.ok && msg.action === 'restore') await setTabState(msg.tabId, '');
        sendResponse(result);
        break;
      }

      /* content → translate a batch (background does the fetch) */
      case 'ltp-translate': {
        try {
          const s = await getSettings();
          let source = s.sourceLang;
          if (source === 'auto') {
            source = await detectLanguage(msg.texts.join(' ').slice(0, 500));
          }
          const translations = await translateBatch(msg.texts, source, s.targetLang);
          sendResponse({ ok: true, translations, source });
        } catch (e) {
          sendResponse({ ok: false, error: e.message || String(e) });
        }
        break;
      }

      /* content → progress / completion */
      case 'ltp-progress': {
        if (tabId != null) {
          await setTabProgress(tabId, msg.ratio || 0);
          broadcastProgress(msg.ratio || 0, tabId);
        }
        break;
      }
      case 'ltp-done': {
        if (tabId != null) {
          broadcastProgress(1, tabId); // on signale 100% au popup
          const p = pendingInjections.get(tabId);
          if (p) {
            pendingInjections.delete(tabId);
            p(msg);
          }
        }
        break;
      }

      /* content → demande de détection de langue (pour le bandeau) */
      case 'ltp-detect': {
        try {
          const data = await ltFetch('/detect', { q: msg.q });
          const lang = LtpDetect.parseDetectResponse(data);
          sendResponse({ ok: true, language: lang || null });
        } catch (e) {
          sendResponse({ ok: false, error: e.message || String(e) });
        }
        break;
      }

      /* bandeau → est-ce que ce site est exclu ? (hostname) */
      case 'ltp-is-excluded': {
        const excluded = await isSiteExcluded(msg.hostname);
        sendResponse({ ok: true, excluded: excluded });
        break;
      }

      /* bandeau → exclure le site courant */
      case 'ltp-add-exclusion': {
        const excludedSites = await addSiteExclusion(msg.hostname);
        sendResponse({ ok: true, excludedSites });
        break;
      }

      /* bandeau → traduire la page courante (sender.tab.id) */
      case 'ltp-self-translate': {
        if (tabId != null) {
          const result = await inject(tabId, 'translate');
          if (result.ok) await setTabState(tabId, 'translated');
          sendResponse(result);
        } else {
          sendResponse({ ok: false, error: 'Aucun onglet source.' });
        }
        break;
      }

      /* options/popup → exclure / retirer / lister les sites */
      case 'ltp-add-exclusion-url': {
        const excludedSites = await addSiteExclusion(msg.url);
        sendResponse({ ok: true, excludedSites });
        break;
      }
      case 'ltp-remove-exclusion': {
        const excludedSites = await removeSiteExclusion(msg.hostname);
        sendResponse({ ok: true, excludedSites });
        break;
      }
      case 'ltp-get-exclusions': {
        const s = await getSettings();
        sendResponse({ ok: true, excludedSites: LtpExclusions.listEntries(s.excludedSites) });
        break;
      }

      /* popup/options → server status */
      case 'ltp-status': {
        try {
          const langs = await ltFetch('/languages');
          sendResponse({ ok: true, languages: langs });
        } catch (e) {
          sendResponse({ ok: false, error: e.message || String(e) });
        }
        break;
      }

      default:
        sendResponse({ ok: false, error: 'message inconnu: ' + msg.type });
    }
  })();
  return true; /* async sendResponse */
});

/* ---------- menu contextuel : traduire la sélection ---------- */

const SELECTION_MENU_ID = 'ltp-translate-selection';

function createSelectionMenu() {
  browser.menus.removeAll()
    .then(() => browser.menus.create({
      id: SELECTION_MENU_ID,
      title: 'Traduire la sélection',
      contexts: ['selection']
    }))
    .catch(() => {});
}

browser.menus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== SELECTION_MENU_ID) return;
  const text = (info.selectionText || '').trim();
  const tabId = tab && tab.id;
  if (!text || tabId == null) return;

  // Injecte la bulle (idempotent) et capture la position de la sélection
  // tant qu'elle est encore visible (avant la fin de la traduction).
  try {
    await browser.tabs.executeScript(tabId, { file: 'content/selection.js', runAt: 'document_idle' });
    await browser.tabs.sendMessage(tabId, { type: 'ltp-selection-capture' });
  } catch (e) { /* page protégée : pas de bulle possible */ }

  try {
    const res = await translateSingleText(text);
    await browser.tabs.sendMessage(tabId, {
      type: 'ltp-selection-result', original: text,
      translated: res.translated, source: res.source, target: res.target
    }).catch(() => {});
  } catch (e) {
    await browser.tabs.sendMessage(tabId, {
      type: 'ltp-selection-result', original: text, error: e.message || String(e)
    }).catch(() => {});
  }
});

createSelectionMenu();
