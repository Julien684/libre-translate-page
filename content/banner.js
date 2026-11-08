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
    const s = await browser.storage.local.get(['autoBanner', 'autoTranslate', 'targetLang']);
    if (s.autoBanner === false && !s.autoTranslate) return; // bandeau ET auto désactivés

    // Site exclu ? On ne fait rien (ni bandeau, ni auto-traduction).
    const ex = await send({ type: 'ltp-is-excluded', hostname: location.hostname });
    if (ex && ex.excluded) return;

    try { if (sessionStorage.getItem('ltpBannerDismissed') === '1') return; } catch (e) {}

    const sample = await collectSample();
    if (sample.length < 15) return; // page trop vide

    const det = await send({ type: 'ltp-detect', q: sample });
    if (!det || !det.ok || !det.language) return;

    const target = (s.targetLang || 'fr').split('-')[0].toLowerCase();
    const detected = det.language.split('-')[0].toLowerCase();
    if (detected === target) return; // même langue, inutile

    // Traduction automatique : on traduit la page sans afficher de bandeau.
    if (s.autoTranslate) {
      send({ type: 'ltp-self-translate' }).catch(() => {});
      return;
    }

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
      '#ltp-banner #ltp-b-x:hover{color:#fff;}',
      '#ltp-banner #ltp-prog{align-items:center;gap:12px;}',
      '#ltp-banner .pbar{width:160px;height:8px;border-radius:4px;background:rgba(255,255,255,.18);overflow:hidden;}',
      '#ltp-banner .pfill{height:100%;width:0%;border-radius:4px;background:linear-gradient(90deg,#4f7cff,#8a5cff);transition:width .25s ease;}',
      '#ltp-banner .ppct{font-weight:600;min-width:38px;text-align:right;}'
    ].join('');
    document.documentElement.appendChild(style);

    const el = document.createElement('div');
    el.id = 'ltp-banner';
    el.innerHTML =
      '<div id="ltp-suggest">' +
        '<span class="t">🌐 Cette page est en <b></b></span>' +
        '<button id="ltp-b-tr">Traduire</button>' +
        '<button id="ltp-b-x" title="Désactiver la suggestion">✕</button>' +
      '</div>' +
      '<div id="ltp-prog">' +
        '<span class="t">🌐 Traduction en cours…</span>' +
        '<div class="pbar"><div class="pfill" id="ltp-pfill"></div></div>' +
        '<span class="ppct" id="ltp-ppct">0%</span>' +
      '</div>';
    el.querySelector('.t b').textContent = name;
    // Masquage via CSSOM (élément.style) : contrairement à un attribut
    // style="display:none" écrit dans innerHTML, une mutation CSSOM n'est
    // PAS bloquée par la CSP de la page (ex. kernel.org sans style-src).
    el.querySelector('#ltp-prog').style.display = 'none';
    document.documentElement.appendChild(el);

    el.querySelector('#ltp-b-tr').addEventListener('click', () => {
      try { sessionStorage.setItem('ltpBannerDismissed', '1'); } catch (e) {}
      enterProgressMode();
      // Le background reçoit le message avec sender.tab.id et injecte translate.js.
      send({ type: 'ltp-self-translate' }).catch(() => {});
    });

    el.querySelector('#ltp-b-x').addEventListener('click', () => {
      try { sessionStorage.setItem('ltpBannerDismissed', '1'); } catch (e) {}
      // ✕ désactive définitivement la suggestion (option).
      browser.storage.local.set({ autoBanner: false }).catch(() => {});
      el.remove();
    });

    /* ---------- barre de progression dans le bandeau ----------
       Au clic sur « Traduire », le bandeau passe en mode progression : il
       écoute les broadcasts du background (ltp-progress-broadcast), met à
       jour la barre, puis disparaît 3 s après avoir atteint 100 %. */
    let tracker = null;
    let hideTimer = null;

    function enterProgressMode() {
      tracker = LtpProgress.makeTracker(3000);
      el.querySelector('#ltp-suggest').style.display = 'none';
      el.querySelector('#ltp-prog').style.display = 'flex';
    }

    browser.runtime.onMessage.addListener((msg) => {
      if (!tracker || !msg || msg.type !== 'ltp-progress-broadcast' || typeof msg.ratio !== 'number') return;
      tracker.update(msg.ratio);
      const pct = tracker.percent();
      el.querySelector('#ltp-pfill').style.width = pct + '%';
      el.querySelector('#ltp-ppct').textContent = pct + '%';
      if (tracker.isComplete() && !hideTimer) {
        // 100 % atteint : le bandeau disparaît après 3 s.
        hideTimer = setTimeout(() => { el.remove(); }, tracker.hideDelayMs);
      }
    });
  }

  main().catch(() => {});
})();
