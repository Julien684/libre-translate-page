/* Libre Translate Page — background script (MV2, Firefox) */
'use strict';

const DEFAULTS = {
  serverUrl: 'http://localhost:5000',
  apiKey: '',
  sourceLang: 'auto',
  targetLang: 'fr'
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
  let url = s.serverUrl.replace(/\/+$/, '') + path;
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (s.apiKey) {
    // LibreTranslate accepts the key either as a Bearer header or as the
    // `api_key` query param. Send both so either server config works.
    headers['Authorization'] = 'Bearer ' + s.apiKey;
    url += (url.includes('?') ? '&' : '?') + 'api_key=' + encodeURIComponent(s.apiKey);
  }

  let res;
  try {
    res = await fetch(url, {
      method: method || (body ? 'POST' : 'GET'),
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
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
  let out = String(data.translatedText || '').split('\n');
  if (out.length === texts.length) return out;

  /* Fallback: newline handling mismatch → translate one by one. */
  out = [];
  for (const t of texts) {
    const r = await ltFetch('/translate', { q: t, source, target, format: 'text' });
    out.push(r.translatedText);
  }
  return out;
}

async function detectLanguage(q) {
  try {
    const data = await ltFetch('/detect', { q });
    if (data && data.language) return data.language;
    throw new Error('réponse inattendue');
  } catch (e) {
    if (e instanceof TypeError) throw e;
    throw new Error('Le serveur ne supporte pas la détection automatique — choisissez une langue source dans les options.');
  }
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

/* ---------- content script injection ---------- */

const pendingInjections = new Map(); /* tabId -> resolve */

function inject(tabId, action) {
  return new Promise((resolve) => {
    pendingInjections.set(tabId, resolve);
    const timeout = setTimeout(() => {
      if (pendingInjections.has(tabId)) {
        pendingInjections.delete(tabId);
        resolve({ ok: false, error: 'Délai dépassé (timeout) pendant la traduction.' });
      }
    }, 120000);

    const file = action === 'restore' ? 'content/restore.js' : 'content/translate.js';
    browser.tabs
      .executeScript(tabId, { file, runAt: 'document_idle' })
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
        if (tabId != null) await setTabProgress(tabId, msg.ratio || 0);
        break;
      }
      case 'ltp-done': {
        if (tabId != null) {
          const p = pendingInjections.get(tabId);
          if (p) {
            pendingInjections.delete(tabId);
            p(msg);
          }
        }
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
