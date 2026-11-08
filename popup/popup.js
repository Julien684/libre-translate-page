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

// Le bouton d'exclusion n'a de sens qu'en mode traduction automatique.
function updateExcludeVisibility() {
  $('exclude').style.display = $('autoTranslate').checked ? 'block' : 'none';
}

function getSettings() {
  return new Promise((resolve) => {
    browser.storage.local.get(
      ['serverUrl', 'apiKey', 'sourceLang', 'targetLang', 'autoBanner', 'autoTranslate'],
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

/* ---------- barre de progression du popup ----------
   Le popup (page d'extension) reçoit ltp-progress-broadcast ; il affiche le %
   et masque la barre 3 s après 100 % (même machine à états que le bandeau). */
let progressTracker = null;
let progressTimer = null;

function showProgress() { $('progress').style.display = 'block'; }
function hideProgress() {
  $('progress').style.display = 'none';
  if (progressTimer) { clearInterval(progressTimer); progressTimer = null; }
  progressTracker = null;
}

function paintProgress(pct) {
  $('progressFill').style.width = pct + '%';
  $('progressPct').textContent = pct + '%';
}

function onProgressBroadcast(msg) {
  if (!msg || typeof msg.ratio !== 'number') return;
  if (!progressTracker) progressTracker = LtpProgress.makeTracker(3000);
  progressTracker.update(msg.ratio);
  showProgress();
  paintProgress(progressTracker.percent());

  if (!progressTimer) {
    progressTimer = setInterval(() => {
      if (progressTracker && progressTracker.shouldHide(Date.now())) hideProgress();
    }, 150);
  }
}

browser.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === 'ltp-progress-broadcast') onProgressBroadcast(msg);
});

/* ---------- init ---------- */

async function init() {
  const s = await getSettings();
  $('server').value = s.serverUrl || 'https://libretranslate.com';
  $('apiKey').value = s.apiKey || '';
  $('source').value = s.sourceLang || 'auto';
  $('target').value = s.targetLang || 'fr';
  $('autoBanner').checked = s.autoBanner !== false;
  $('autoTranslate').checked = !!s.autoTranslate;
  updateExcludeVisibility();

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
    serverUrl: $('server').value.trim().replace(/\/+$/, '') || 'https://libretranslate.com',
    apiKey: $('apiKey').value.trim(),
    sourceLang: $('source').value,
    targetLang: $('target').value,
    autoBanner: $('autoBanner').checked,
    autoTranslate: $('autoTranslate').checked
  };
  return browser.storage.local.set(data);
}

// Les toggles sont sauvegardés immédiatement (pas besoin de traduire).
$('autoBanner').addEventListener('change', () => {
  browser.storage.local.set({ autoBanner: $('autoBanner').checked });
});
$('autoTranslate').addEventListener('change', () => {
  browser.storage.local.set({ autoTranslate: $('autoTranslate').checked });
  updateExcludeVisibility();
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
  hideProgress();
  showStatus('Traduction en cours…');
  const resp = await browser.runtime.sendMessage({ type: 'ltp-inject', tabId: tab.id, action: 'translate' });
  setBusy(false);
  if (resp && resp.ok) {
    showStatus(resp.partial ? '⚠ Traduction partielle : ' + resp.error : '✓ Page traduite', resp.partial ? 'err' : 'ok');
    // 100 % forcé : la barre du popup disparaîtra après 3 s.
    if (progressTracker) { progressTracker.update(1.0); showProgress(); paintProgress(100); }
  } else {
    hideProgress();
    showStatus('✗ ' + (resp && resp.error || 'erreur inconnue'), 'err');
  }
});

$('restore').addEventListener('click', async () => {
  const tab = await getActiveTab();
  if (!tab) return;
  setBusy(true);
  hideProgress();
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

$('exclude').addEventListener('click', async () => {
  const tab = await getActiveTab();
  if (!tab) return showStatus('Aucun onglet actif', 'err');
  let host = '';
  try { host = new URL(tab.url).hostname; } catch (e) {}
  if (!host) return showStatus('Page non supportée (URL invalide)', 'err');
  const resp = await browser.runtime.sendMessage({ type: 'ltp-add-exclusion-url', url: host });
  if (resp && resp.ok) showStatus('✓ Site exclu : ' + host, 'ok');
  else showStatus('✗ ' + (resp && resp.error || 'erreur inconnue'), 'err');
});

updateExcludeVisibility();
init();
