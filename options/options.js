/* Libre Translate Page — options script */
'use strict';

const $ = (id) => document.getElementById(id);

const DEFAULTS = {
  serverUrl: 'http://localhost:5000',
  apiKey: '',
  sourceLang: 'auto',
  targetLang: 'fr'
};

async function load() {
  const s = await browser.storage.local.get(Object.keys(DEFAULTS));
  $('server').value = s.serverUrl || DEFAULTS.serverUrl;
  $('apiKey').value = s.apiKey || '';
  $('source').value = s.sourceLang || DEFAULTS.sourceLang;
  $('target').value = s.targetLang || DEFAULTS.targetLang;
}

$('save').addEventListener('click', async () => {
  const data = {
    serverUrl: $('server').value.trim().replace(/\/+$/, '') || DEFAULTS.serverUrl,
    apiKey: $('apiKey').value.trim(),
    sourceLang: $('source').value.trim() || 'auto',
    targetLang: $('target').value.trim() || 'fr'
  };
  await browser.storage.local.set(data);
  const st = $('status');
  st.textContent = '✓ Options enregistrées';
  st.className = 'ok';
  setTimeout(() => { st.textContent = ''; }, 2500);
});

load();
