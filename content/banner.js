/* Libre Translate Page — content script : bandeau de suggestion de traduction */
'use strict';

(function () {
  if (window.__ltpBannerLoaded) return;
  window.__ltpBannerLoaded = true;

  // Pas de bandeau sur les pages non http(s) ni déjà traduite.
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

  async function main() {
    const s = await browser.storage.local.get('autoBanner');
    if (s.autoBanner === false) return; // option désactivée

    // Cette session a-t-elle déjà fermé le bandeau ?
    try { if (sessionStorage.getItem('ltpBannerDismissed') === '1') return; } catch (e) {}

    // Extrait un échantillon de texte significatif de la page.
    const bodyText = (document.body && document.body.innerText) || '';
    const sample = bodyText.replace(/\s+/g, ' ').trim().slice(0, 400);
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
    // Nom lisible de la langue via /languages (best effort).
    send({ type: 'ltp-status' }).then((resp) => {
      let name = langCode;
      if (resp && resp.ok && Array.isArray(resp.languages)) {
        const l = resp.languages.find((x) => x.code === langCode);
        if (l) name = l.name;
      }
      build(name);
    }).catch(() => build(langCode));

    function build(name) {
      const style = document.createElement('style');
      style.textContent = [
        '#ltp-banner{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);',
        'z-index:2147483647;display:flex;align-items:center;gap:14px;',
        'background:#1f2430;color:#fff;padding:12px 18px;border-radius:12px;',
        'box-shadow:0 6px 24px rgba(0,0,0,.35);font:14px system-ui,sans-serif;max-width:90vw;}',
        '#ltp-banner .t{font-weight:600;white-space:nowrap;}',
        '#ltp-banner button{border:none;border-radius:8px;padding:8px 14px;font:inherit;',
        'font-weight:600;cursor:pointer;white-space:nowrap;}',
        '#ltp-banner #ltp-b-tr{background:#4f7cff;color:#fff;}',
        '#ltp-banner #ltp-b-tr:hover{background:#3d69ec;}',
        '#ltp-banner #ltp-b-x{background:transparent;color:#aab;}',
        '#ltp-banner #ltp-b-x:hover{color:#fff;}'
      ].join('');
      document.documentElement.appendChild(style);

      const el = document.createElement('div');
      el.id = 'ltp-banner';
      el.innerHTML =
        '<span class="t">🌐 Cette page est en <b>' + name + '</b></span>' +
        '<button id="ltp-b-tr">Traduire</button>' +
        '<button id="ltp-b-x" title="Ne plus suggérer">✕</button>';
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
  }

  main().catch(() => {});
})();
