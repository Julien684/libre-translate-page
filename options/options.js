/* Libre Translate Page — options script
   Gère : serveur, langues, bandeau, auto-traduction, et la liste des
   exclusions (ajout par URL, liste, corbeille). */
'use strict';

const $ = (id) => document.getElementById(id);

const DEFAULTS = {
  serverUrl: 'https://libretranslate.com',
  apiKey: '',
  sourceLang: 'auto',
  targetLang: 'fr',
  autoBanner: true,
  autoTranslate: false,
  excludedSites: []
};

function updateExclusionsVisibility() {
  const card = $('exclCard');
  if (card) card.style.display = $('autoTranslate').checked ? '' : 'none';
}

async function load() {
  const s = await browser.storage.local.get(Object.keys(DEFAULTS));
  $('server').value = s.serverUrl || DEFAULTS.serverUrl;
  const apiField = $('apiKey');
  apiField.value = s.apiKey || '';
  $('source').value = s.sourceLang || DEFAULTS.sourceLang;
  $('target').value = s.targetLang || DEFAULTS.targetLang;
  $('autoBanner').checked = s.autoBanner !== false;
  $('autoTranslate').checked = !!s.autoTranslate;
  renderExclusions(s.excludedSites || []);
  updateExclusionsVisibility();
}

/* ---------- exclusions ---------- */

function renderExclusions(entries) {
  const list = $('exclList');
  list.innerHTML = '';
  const items = LtpExclusions.listEntries(entries);
  $('exclEmpty').style.display = items.length ? 'none' : 'block';
  for (const e of items) {
    const li = document.createElement('li');
    const dom = document.createElement('span');
    dom.className = 'dom';
    dom.textContent = e;
    const btn = document.createElement('button');
    btn.className = 'trash';
    btn.title = 'Retirer de la liste';
    btn.textContent = '\u{1F5D1}';
    btn.addEventListener('click', () => removeExclusion(e));
    li.appendChild(dom);
    li.appendChild(btn);
    list.appendChild(li);
  }
}

function sendMsg(msg) {
  return new Promise((resolve) => {
    browser.runtime.sendMessage(msg, (resp) => {
      if (browser.runtime.lastError) resolve({ ok: false, error: browser.runtime.lastError.message });
      else resolve(resp);
    });
  });
}

async function addExclusion(input) {
  const url = (input || '').trim();
  if (!url) return;
  const resp = await sendMsg({ type: 'ltp-add-exclusion-url', url: url });
  if (resp && resp.ok) {
    $('exclInput').value = '';
    renderExclusions(resp.excludedSites);
  }
}

async function removeExclusion(hostname) {
  const resp = await sendMsg({ type: 'ltp-remove-exclusion', hostname: hostname });
  if (resp && resp.ok) renderExclusions(resp.excludedSites);
}

$('exclAdd').addEventListener('click', () => addExclusion($('exclInput').value));
$('exclInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    addExclusion($('exclInput').value);
  }
});

/* ---------- enregistrement ---------- */

$('save').addEventListener('click', async () => {
  const apiField = $('apiKey');
  const rawSecret = apiField.value;
  const data = {
    serverUrl: $('server').value.trim().replace(/\/+$/, '') || DEFAULTS.serverUrl,
    apiKey: rawSecret.trim(),
    sourceLang: $('source').value.trim() || 'auto',
    targetLang: $('target').value.trim() || 'fr',
    autoBanner: $('autoBanner').checked,
    autoTranslate: $('autoTranslate').checked
  };
  await browser.storage.local.set(data);
  const st = $('status');
  st.textContent = '✓ Options enregistrées';
  st.className = 'ok';
  setTimeout(() => { st.textContent = ''; }, 2500);
});

$('autoTranslate').addEventListener('change', updateExclusionsVisibility);

browser.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.excludedSites) {
    renderExclusions(changes.excludedSites.newValue || []);
  }
});

updateExclusionsVisibility();
load();
