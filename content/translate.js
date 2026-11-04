/* Libre Translate Page — content script : traduction de la page */
'use strict';

(function () {
  if (window.__ltpTranslated) return;
  window.__ltpTranslated = true;

  const SKIP_TAGS = new Set([
    'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'TEXTAREA', 'CODE', 'PRE',
    'KBD', 'SAMP', 'VAR', 'IFRAME', 'SVG', 'MATH', 'OPTION', 'TITLE', 'META'
  ]);

  const BATCH_SIZE = 25;
  const MAX_LEN = 1500;

  function collectTextNodes(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        let el = node.parentElement;
        while (el) {
          if (SKIP_TAGS.has(el.tagName) || el.isContentEditable) {
            return NodeFilter.FILTER_REJECT;
          }
          el = el.parentElement;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes = [];
    let n;
    while ((n = walker.nextNode())) nodes.push(n);
    return nodes;
  }

  function translateBatch(texts) {
    return new Promise((resolve) => {
      browser.runtime.sendMessage({ type: 'ltp-translate', texts }, (resp) => {
        if (browser.runtime.lastError) {
          resolve({ ok: false, error: browser.runtime.lastError.message });
        } else {
          resolve(resp);
        }
      });
    });
  }

  async function translatePage() {
    const nodes = collectTextNodes(document.body);
    const total = Math.ceil(nodes.length / BATCH_SIZE);
    let done = 0;

    for (let i = 0; i < nodes.length; i += BATCH_SIZE) {
      const chunk = nodes.slice(i, i + BATCH_SIZE);
      const chunks = chunk.map((node) => {
        const m = node.nodeValue.match(/^(\s*)([\s\S]*?)(\s*)$/);
        return { node, leading: m ? m[1] : '', trailing: m ? m[3] : '' };
      });
      const texts = chunks.map((c) => c.node.nodeValue.trim().slice(0, MAX_LEN));

      const resp = await translateBatch(texts);
      if (!resp.ok) {
        browser.runtime.sendMessage({
          type: 'ltp-done',
          ok: done > 0,
          partial: done > 0,
          error: resp.error
        });
        return;
      }
      chunks.forEach((c, j) => {
        const translated = resp.translations && resp.translations[j];
        if (!translated) return; // keep original if nothing came back
        c.node.nodeValue = c.leading + translated + c.trailing;
      });
      done++;
      browser.runtime.sendMessage({ type: 'ltp-progress', ratio: done / total });
    }

    browser.runtime.sendMessage({ type: 'ltp-done', ok: true });
  }

  translatePage();
})();
