/* Renders FULL_SITE_TEST_CHECKLIST.md into headings + (optional) checkboxes.
   Minimal markdown support: #/##/###, bullet lines, task lines (- [ ] / - [x]). */

(function () {
  const root = document.getElementById('checklistRoot');
  const errorBox = document.getElementById('checklistError');

  function escapeHtml(text) {
    return String(text)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function renderInline(text) {
    // Render inline code `like this`.
    // Keep it minimal and safe.
    const parts = String(text).split('`');
    if (parts.length === 1) return escapeHtml(text);

    let out = '';
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (i % 2 === 1) {
        out += `<span class="mono">${escapeHtml(part)}</span>`;
      } else {
        out += escapeHtml(part);
      }
    }
    return out;
  }

  function el(tag, html) {
    const node = document.createElement(tag);
    if (html != null) node.innerHTML = html;
    return node;
  }

  function parse(md) {
    const container = document.createDocumentFragment();

    const lines = String(md).replaceAll('\r\n', '\n').split('\n');

    let currentList = null;
    let inCodeBlock = false;
    let codeLines = [];

    function flushList() {
      if (currentList) {
        container.appendChild(currentList);
        currentList = null;
      }
    }

    function flushCodeBlock() {
      if (!inCodeBlock) return;
      const pre = document.createElement('pre');
      pre.className = 'mono';
      pre.style.whiteSpace = 'pre-wrap';
      pre.style.background = 'rgba(0,0,0,0.2)';
      pre.style.border = '1px solid rgba(255,255,255,0.08)';
      pre.style.borderRadius = '10px';
      pre.style.padding = '10px';
      pre.textContent = codeLines.join('\n');
      container.appendChild(pre);
      codeLines = [];
      inCodeBlock = false;
    }

    for (const rawLine of lines) {
      const line = rawLine;

      if (line.trim().startsWith('```')) {
        if (inCodeBlock) {
          flushCodeBlock();
        } else {
          flushList();
          inCodeBlock = true;
          codeLines = [];
        }
        continue;
      }

      if (inCodeBlock) {
        codeLines.push(line);
        continue;
      }

      const trimmed = line.trim();
      if (trimmed.length === 0) {
        flushList();
        continue;
      }

      const h3 = trimmed.startsWith('### ');
      const h2 = trimmed.startsWith('## ');
      const h1 = trimmed.startsWith('# ');

      if (h1 || h2 || h3) {
        flushList();
        const text = trimmed.replace(/^#{1,3}\s+/, '');
        const tag = h1 ? 'h1' : h2 ? 'h2' : 'h3';
        container.appendChild(el(tag, renderInline(text)));
        continue;
      }

      const isTask = /^- \[( |x|X)\] /.test(trimmed);
      const isBullet = trimmed.startsWith('- ');

      if (isTask || isBullet) {
        if (!currentList) currentList = document.createElement('ul');

        const li = document.createElement('li');

        if (isTask) {
          const checked = /^- \[(x|X)\] /.test(trimmed);
          const labelText = trimmed.replace(/^- \[( |x|X)\] /, '');

          const wrap = document.createElement('div');
          wrap.className = 'task';

          const cb = document.createElement('input');
          cb.type = 'checkbox';
          cb.checked = checked;

          const label = document.createElement('div');
          label.innerHTML = renderInline(labelText);

          wrap.appendChild(cb);
          wrap.appendChild(label);
          li.appendChild(wrap);
        } else {
          li.innerHTML = renderInline(trimmed.replace(/^-\s+/, ''));
        }

        currentList.appendChild(li);
        continue;
      }

      // Paragraph fallback
      flushList();
      container.appendChild(el('p', renderInline(trimmed)));
    }

    flushList();
    flushCodeBlock();

    return container;
  }

  async function load() {
    try {
      const res = await fetch('./FULL_SITE_TEST_CHECKLIST.md', { cache: 'no-store' });
      if (!res.ok) {
        throw new Error(`Failed to load FULL_SITE_TEST_CHECKLIST.md (HTTP ${res.status})`);
      }
      const md = await res.text();
      root.innerHTML = '';
      root.appendChild(parse(md));
    } catch (e) {
      errorBox.style.display = 'block';
      errorBox.textContent = String(e && e.stack ? e.stack : e);
    }
  }

  load();
})();
