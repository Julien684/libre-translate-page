/* Libre Translate Page — content script : bandeau de suggestion de traduction */
'use strict';

(function () {
  if (window.__ltpBannerLoaded) return;
  window.__ltpBannerLoaded = true;

  // Pas de bandeau hors http/https.
  if (!/^https?:$/.test(location.protocol)) return;

  const send = (msg) =>
    new Promise((resolve) => {
      try {
        browser.runtime.sendMessage(msg, (resp) => {
          if (browser.runtime.lastError) resolve({ ok: false, error: browser.runtime.lastError.message });
          else resolve(resp);
        });
      } catch (e) {
        resolve({ ok: false, error: String(e) });
      }
    });

  // Noms de langues courantes (affichage rapide, sans appel réseau).
  const LANG_NAMES = {
    en: 'Anglais', fr: 'Français', de: 'Allemand', es: 'Espagnol', it: 'Italien',
    pt: 'Portugais', nl: 'Néerlandais', pl: 'Polonais', ru: 'Russe', ja: 'Japonais',
    ko: 'Coréen', zh: 'Chinois', 'zh-Hans': 'Chinois (simplifié)', 'zh-Hant': 'Chinois (traditionnel)',
    ar: 'Arabe', tr: 'Turc', sv: 'Suédois', da: 'Danois', fi: 'Finnois', no: 'Norvégien',
    nb: 'Norvégien', nn: 'Norvégien', hu: 'Hongrois', ro: 'Roumain', cs: 'Tchèque',
    sk: 'Slovaque', uk: 'Ukrainien', el: 'Grec', he: 'Hébreu', hi: 'Hindi',
    th: 'Thaï', vi: 'Vietnamien', id: 'Indonésien', ms: 'Malais', fa: 'Persan',
    bn: 'Bengali', bg: 'Bulgare', et: 'Estonien', lv: 'Letton', lt: 'Lituanien',
    sl: 'Slovène', sq: 'Albanais', sr: 'Serbe', hr: 'Croate', be: 'Biélorusse',
    kk: 'Kazakh', ky: 'Kirghiz', ur: 'Ourdou', sw: 'Swahili', tl: 'Filipino',
    eo: 'Espéranto', eu: 'Basque', ga: 'Irlandais', gl: 'Galicien'
  };

  function getSample() {
    const t = ((document.body && document.body.innerText) || '').replace(/\s+/g, ' ').trim();
    return t.slice(0, 400);
  }

  // Les SPA / pages lentes n'ont parfois pas assez de texte au moment du
  // document_idle : on réessaie jusqu'à 4 fois (800 ms d'intervalle).
  async function collectSample() {
    for (let i = 0; i < 4; i++) {
      const s = getSample();
      if (s.length >= 15) return s;
      await new Promise((r) => setTimeout(r, 800));
    }
    return getSample();
  }

  async function main() {
    const s = await browser.storage.local.get('autoBanner');
    if (s.autoBanner === false) return; // option désactivée

    try { if (sessionStorage.getItem('ltpBannerDismissed') === '1') return; } catch (e) {}

    const sample = await collectSample();
    if (sample.length < 15) return; // page trop vide

    const det = await send({ type: 'ltp-detect', q: sample });
    if (!det || !det.ok || !det.language) return;

    const s2 = await browser.storage.local.get('targetLang');
    const target = (s2.targetLang || 'fr').split('-')[0].toLowerCase();
    const detected = det.language.split('-')[0].toLowerCase();
    if (detected === target) return; // même langue, inutile

    showBanner(det.language);
  }

  function showBanner(langCode) {
    const name = LANG_NAMES[langCode] || langCode;

    const style = document.createElement('style');
    style.textContent = [
      '#ltp-banner{position:fixed;top:12px;left:50%;transform:translateX(-50%);',
      'z-index:2147483647;display:flex;align-items:center;gap:14px;',
      'background:#1f2430;color:#fff;padding:12px 18px;border-radius:12px;',
      'box-shadow:0 6px 24px rgba(0,0,0,.35);',
      'font:14px system-ui,-apple-system,sans-serif;max-width:92vw;box-sizing:border-box;}',
      '#ltp-banner .t{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '#ltp-banner button{border:none;border-radius:8px;padding:8px 14px;',
      'font:inherit;font-weight:600;cursor:pointer;white-space:nowrap;}',
      '#ltp-banner #ltp-b-tr{background:#4f7cff;color:#fff;}',
      '#ltp-banner #ltp-b-tr:hover{background:#3d69ec;}',
      '#ltp-banner #ltp-b-x{background:transparent;color:#aab;font-size:16px;line-height:1;padding:8px 10px;}',
      '#ltp-banner #ltp-b-x:hover{color:#fff;}'
    ].join('');
    document.documentElement.appendChild(style);

    const el = document.createElement('div');
    el.id = 'ltp-banner';
    el.innerHTML =
      '<span class="t">🌐 Cette page est en <b></b></span>' +
      '<button id="ltp-b-tr">Traduire</button>' +
      '<button id="ltp-b-x" title="Désactiver la suggestion">✕</button>';
    el.querySelector('.t b').textContent = name;
    document.documentElement.appendChild(el);

    el.querySelector('#ltp-b-tr').addEventListener('click', () => {
      try { sessionStorage.setItem('ltpBannerDismissed', '1'); } catch (e) {}
      el.remove();
      // Le background reçoit le message avec sender.tab.id et injecte translate.js.
      send({ type: 'ltp-self-translate' }).catch(() => {});
    });

    el.querySelector('#ltp-b-x').addEventListener('click', () => {
      try { sessionStorage.setItem('ltpBannerDismissed', '1'); } catch (e) {}
      // ✕ désactive définitivement la suggestion (option).
      browser.storage.local.set({ autoBanner: false }).catch(() => {});
      el.remove();
    });
  }

  main().catch(() => {});
})();
