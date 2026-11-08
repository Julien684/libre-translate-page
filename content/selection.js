/* Libre Translate Page — content script injecté à la demande :
   affiche une bulle avec la traduction d'un texte sélectionné (menu contextuel).
   Ne dépend d'aucun global Ltp* ; se positionne près de la sélection. */
'use strict';

(function () {
  if (window.__ltpSelectionLoaded) return;
  window.__ltpSelectionLoaded = true;

  let lastRect = null;

  function captureRect() {
    try {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const r = sel.getRangeAt(0).getBoundingClientRect();
        if (r && (r.width || r.height || r.top || r.left)) lastRect = r;
      }
    } catch (e) { /* ignore */ }
  }

  function ensureStyle() {
    if (document.getElementById('ltp-sel-style')) return;
    const st = document.createElement('style');
    st.id = 'ltp-sel-style';
    st.textContent = [
      '#ltp-sel-pop{position:fixed;z-index:2147483647;max-width:360px;',
      'background:#1f2430;color:#fff;border-radius:10px;padding:12px 14px 12px;',
      'box-shadow:0 8px 28px rgba(0,0,0,.4);font:14px/1.45 system-ui,-apple-system,sans-serif;',
      'box-sizing:border-box;}',
      '#ltp-sel-pop .lbl{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#8fa4c8;margin:0 0 2px;}',
      '#ltp-sel-pop .orig{color:#aab;font-size:12px;margin-bottom:8px;max-height:72px;overflow:auto;}',
      '#ltp-sel-pop .tr{font-weight:600;white-space:pre-wrap;word-break:break-word;max-height:240px;overflow:auto;}',
      '#ltp-sel-pop .tr.err{color:#ff8a8a;font-weight:500;}',
      '#ltp-sel-pop .x{position:absolute;top:4px;right:6px;background:transparent;border:none;',
      'color:#889;cursor:pointer;font-size:15px;line-height:1;padding:4px;}',
      '#ltp-sel-pop .x:hover{color:#fff;}'
    ].join('');
    document.documentElement.appendChild(st);
  }

  function place(el) {
    const margin = 8;
    const vw = window.innerWidth, vh = window.innerHeight;
    const r = lastRect || { left: vw / 2, top: vh / 2, bottom: vh / 2 };
    el.style.position = 'fixed';
    el.style.visibility = 'hidden';
    el.style.left = '0px';
    el.style.top = '0px';
    document.documentElement.appendChild(el);
    const bw = el.offsetWidth, bh = el.offsetHeight;
    let left = Math.min(Math.max(margin, r.left), Math.max(margin, vw - bw - margin));
    let top = r.bottom + margin;
    if (top + bh > vh - margin) top = Math.max(margin, r.top - bh - margin);
    el.style.left = left + 'px';
    el.style.top = top + 'px';
    el.style.visibility = 'visible';
    el.style.maxWidth = Math.min(360, vw - 2 * margin) + 'px';
  }

  function onOutside(e) {
    const p = document.getElementById('ltp-sel-pop');
    if (p && !p.contains(e.target)) close();
  }
  function onKey(e) {
    if (e.key === 'Escape') close();
  }

  function close() {
    const old = document.getElementById('ltp-sel-pop');
    if (old) old.remove();
    document.removeEventListener('mousedown', onOutside, true);
    document.removeEventListener('keydown', onKey, true);
  }

  function show(msg) {
    ensureStyle();
    close();

    const pop = document.createElement('div');
    pop.id = 'ltp-sel-pop';

    const x = document.createElement('button');
    x.className = 'x';
    x.textContent = '✕';
    x.title = 'Fermer';
    x.addEventListener('click', close);
    pop.appendChild(x);

    const origLbl = document.createElement('div');
    origLbl.className = 'lbl';
    origLbl.textContent = 'Sélection';
    const orig = document.createElement('div');
    orig.className = 'orig';
    orig.textContent = msg.original || '';
    pop.appendChild(origLbl);
    pop.appendChild(orig);

    const trLbl = document.createElement('div');
    trLbl.className = 'lbl';
    trLbl.textContent = 'Traduction' + (msg.target ? ' (' + msg.target + ')' : '');
    pop.appendChild(trLbl);

    const tr = document.createElement('div');
    if (msg.error) {
      tr.className = 'tr err';
      tr.textContent = '⚠ ' + msg.error;
    } else {
      tr.className = 'tr';
      tr.textContent = msg.translated || '—';
    }
    pop.appendChild(tr);

    place(pop);

    // Fermeture au clic extérieur / Échap / après 25 s.
    setTimeout(() => document.addEventListener('mousedown', onOutside, true), 0);
    document.addEventListener('keydown', onKey, true);
    setTimeout(() => { if (document.getElementById('ltp-sel-pop') === pop) close(); }, 25000);
  }

  browser.runtime.onMessage.addListener((msg) => {
    if (!msg) return;
    if (msg.type === 'ltp-selection-capture') {
      captureRect();
      return;
    }
    if (msg.type === 'ltp-selection-result') {
      if (!lastRect) captureRect();
      show(msg);
    }
  });

  // Sélection déjà présente au moment de l'injection : on la capture.
  captureRect();
})();
