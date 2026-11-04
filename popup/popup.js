/* Libre Translate Page — popup script */
'use strict';

const $ = (id) => document.getElementById(id);
const statusEl = $('status');

function showStatus(msg, cls) {
  statusEl.textContent = msg || '';
  statusEl.className = cls || '';
}

function setBusy(busy) {
  $('translate').disabled = busy;
  $('restore').disabled = busy;
}

function getSettings() {
  return new Promise((resolve) => {
    browser.storage.local.get(
      ['serverUrl', 'apiKey', 'sourceLang', 'targetLang', 'autoBanner'],
      resolve
    );
  });
}

async function fillLanguageSelects(langs) {
  const source = $('source');
  const target = $('target');
  source.innerHTML = '';
  target.innerHTML = '';

  const auto = document.createElement('option');
  auto.value = 'auto';
  auto.textContent = 'Auto';
  source.appendChild(auto);

  // /languages renvoie un TABLEAU: [{code, name, targets}, ...]
  const sorted = langs.slice().sort((a, b) => a.name.localeCompare(b.name));
  for (const lang of sorted) {
    for (const sel of [source, target]) {
      const opt = document.createElement('option');
      opt.value = lang.code;
      opt.textContent = lang.name + ' (' + lang.code + ')';
      sel.appendChild(opt);
    }
  }
  target.value = 'fr';
}

async function init() {
  const s = await getSettings();
  $('server').value = s.serverUrl || 'http://localhost:5000';
  $('apiKey').value = s.apiKey || '';
  $('source').value = s.sourceLang || 'auto';
  $('target').value = s.targetLang || 'fr';
  $('autoBanner').checked = s.autoBanner !== false;

  // load languages from server (best effort)
  browser.runtime.sendMessage({ type: 'ltp-status' }, (resp) => {
    if (resp && resp.ok && Array.isArray(resp.languages)) {
      fillLanguageSelects(resp.languages);
      $('source').value = s.sourceLang || 'auto';
      $('target').value = s.targetLang || 'fr';
      showStatus('✓ Serveur joignable (' + resp.languages.length + ' langues)', 'ok');
    } else {
      showStatus('⚠ Serveur injoignable : ' + (resp && resp.error || 'inconnu'), 'err');
    }
  });
}

function saveSettingsFromPopup() {
  const data = {
    serverUrl: $('server').value.trim().replace(/\/+$/, '') || 'http://localhost:5000',
    apiKey: $('apiKey').value.trim(),
    sourceLang: $('source').value,
    targetLang: $('target').value,
    autoBanner: $('autoBanner').checked
  };
  return browser.storage.local.set(data);
}

// Le toggle de la suggestion est sauvegardé immédiatement (pas besoin de traduire).
$('autoBanner').addEventListener('change', () => {
  browser.storage.local.set({ autoBanner: $('autoBanner').checked });
});

function getActiveTab() {
  return new Promise((resolve) => {
    browser.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      resolve(tabs && tabs[0]);
    });
  });
}

$('translate').addEventListener('click', async () => {
  await saveSettingsFromPopup();
  const tab = await getActiveTab();
  if (!tab) return showStatus('Aucun onglet actif', 'err');
  if (!/^https?:/.test(tab.url || '')) {
    return showStatus('Page non supportée (seul http/https est traduisible)', 'err');
  }
  setBusy(true);
  showStatus('Traduction en cours…');
  const resp = await browser.runtime.sendMessage({ type: 'ltp-inject', tabId: tab.id, action: 'translate' });
  setBusy(false);
  if (resp && resp.ok) {
    showStatus(resp.partial ? '⚠ Traduction partielle : ' + resp.error : '✓ Page traduite', resp.partial ? 'err' : 'ok');
  } else {
    showStatus('✗ ' + (resp && resp.error || 'erreur inconnue'), 'err');
  }
});

$('restore').addEventListener('click', async () => {
  const tab = await getActiveTab();
  if (!tab) return;
  setBusy(true);
  showStatus('Restauration…');
  const resp = await browser.runtime.sendMessage({ type: 'ltp-inject', tabId: tab.id, action: 'restore' });
  setBusy(false);
  if (resp && resp.ok) showStatus('✓ Original restauré (rechargement)', 'ok');
  else showStatus('✗ ' + (resp && resp.error || 'erreur inconnue'), 'err');
});

$('optionsLink').addEventListener('click', (e) => {
  e.preventDefault();
  browser.runtime.openOptionsPage();
});

init();
