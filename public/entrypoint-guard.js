const FILE_TO_SECTION = {
  'my-office.html': 'office',
  'accounts.html': 'accounts',
  'quotes.html': 'quotes',
  'calendar.html': 'calendar',
  'reservations-list.html': 'reservations',
  'dispatch-grid.html': 'dispatch',
  'network.html': 'network',
  'settle.html': 'settle',
  'receivables.html': 'receivables',
  'payables.html': 'payables',
  'memos.html': 'memos',
  'files.html': 'files',
  'tools.html': 'tools',
  'reports.html': 'reports',
  'index-reservations.html': 'dashboard',
  'reservation-form.html': 'new-reservation'
};

// Global shared styles (e.g., compact line-height)
(function ensureGlobalCss() {
  try {
    if (!document || !document.head) return;
    if (document.querySelector('link[data-relia-global-css]')) return;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'global.css';
    link.setAttribute('data-relia-global-css', '1');
    document.head.appendChild(link);
  } catch {
    // ignore
  }
})();

// When a page is embedded inside the index.html shell, the shell already renders
// the global header/nav. Many pages also include their own <header class="header">,
// which causes a duplicated "double header" and can lead to duplicate navigation
// actions (iframe posts + shell click handlers).
(function hideEmbeddedPageHeader() {
  try {
    if (window.self === window.top) return;

    const hide = () => {
      try {
        document.querySelectorAll('header.header').forEach((h) => {
          h.style.display = 'none';
        });
      } catch {
        // ignore
      }
    };

    // Run ASAP to avoid a flash, and again after DOM is ready.
    hide();
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', hide, { once: true });
    }
  } catch {
    // ignore
  }
})();

function getCurrentFileName() {
  const p = String(window.location.pathname || '');
  const parts = p.split('/').filter(Boolean);
  const last = parts[parts.length - 1] || '';
  return last || 'index.html';
}

(function enforceIndexEntrypoint() {
  // If we are inside the index iframe shell, do nothing.
  if (window.self !== window.top) return;

  const params = new URLSearchParams(window.location.search);
  const allowStandalone = params.get('standalone') === '1';
  if (allowStandalone) return;
  
  // If opened from reservation form (popup mode), don't redirect
  const fromReservation = params.get('from') === 'reservation';
  if (fromReservation) return;

  const file = getCurrentFileName().toLowerCase();
  if (file === '' || file === 'index.html') return;

  const section = FILE_TO_SECTION[file];
  if (!section) return;

  const relativeUrl = file + (window.location.search || '') + (window.location.hash || '');

  // If this page was opened as a popup/tab from the main shell, don't stay open behind it.
  // Ask the opener to switch sections and then close this window.
  try {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage({ action: 'switchSection', section, url: relativeUrl }, '*');
      try { window.opener.focus(); } catch { /* ignore */ }
      // Browsers only allow closing windows opened by script. If close is blocked,
      // at least navigate away so Accounts isn't running behind the shell.
      setTimeout(() => {
        try { window.close(); } catch { /* ignore */ }
        try { window.location.replace('about:blank'); } catch { /* ignore */ }
      }, 25);
      return;
    }
  } catch {
    // ignore
  }

  // Cross-tab case: if the shell is already open in another tab (no opener),
  // tell it to switch sections and then navigate this standalone tab away.
  try {
    const beatRaw = localStorage.getItem('relia_shell_heartbeat');
    const beatTs = beatRaw ? Number(beatRaw) : 0;
    const shellLikelyOpen = Number.isFinite(beatTs) && (Date.now() - beatTs) < 4500;

    if (shellLikelyOpen) {
      try {
        const bc = new BroadcastChannel('relia_shell');
        bc.postMessage({ type: 'relia:openSection', section, url: relativeUrl, ts: Date.now() });
        try { bc.close(); } catch { /* ignore */ }
      } catch {
        // ignore
      }

      // Fallback via localStorage event
      try {
        localStorage.setItem('relia_shell_switch', JSON.stringify({
          section,
          url: relativeUrl,
          ts: Date.now(),
          nonce: Math.random().toString(36).slice(2)
        }));
      } catch {
        // ignore
      }

      // Don't keep this standalone tab running behind the shell.
      setTimeout(() => {
        try { window.location.replace('about:blank'); } catch { /* ignore */ }
      }, 50);
      return;
    }
  } catch {
    // ignore
  }

  try {
    sessionStorage.setItem('relia_nav_override', JSON.stringify({
      section,
      url: relativeUrl,
      ts: Date.now()
    }));
  } catch {
    // ignore
  }

  const target = `index.html?section=${encodeURIComponent(section)}`;
  window.location.replace(target);
})();
