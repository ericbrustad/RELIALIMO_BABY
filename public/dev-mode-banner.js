// Dev Mode Banner - Shows current data source (Supabase vs Local Storage)
import { isLocalDevModeEnabled, setLocalDevModeEnabled } from './api-service.js';

// Global flag to prevent duplicate initialization
let bannerInitialized = false;

/**
 * Initialize the dev mode banner
 * Call this from your app's initialization code
 */
export function initDevModeBanner() {
  // Prevent duplicate initialization
  if (bannerInitialized) {
    console.log('Dev mode banner already initialized, skipping');
    return;
  }
  
  // Mark as initialized IMMEDIATELY to prevent race conditions
  bannerInitialized = true;
  
  // Only show on localhost
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (!isLocalhost) return;

  createBannerHTML();
  updateBannerState();
  attachEventListeners();
}

// Auto-initialize when script is loaded in the browser
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    try {
      initDevModeBanner();
    } catch (e) {
      console.warn('Dev mode banner init failed:', e);
    }
  });
}

/**
 * Create the banner HTML and inject into page
 */
function createBannerHTML() {
  // Don't create if already exists
  if (document.getElementById('devModeBanner')) {
    console.log('Dev mode banner already exists in DOM, skipping creation');
    return;
  }

  const banner = document.createElement('div');
  banner.id = 'devModeBanner';
  banner.innerHTML = `
    <div class="dev-banner-content">
      <div class="dev-banner-left">
        <span class="dev-banner-icon">🔧</span>
        <span class="dev-banner-text">
          Data Source: <strong id="devModeStatus">Supabase</strong>
        </span>
        <span class="dev-op-indicator" id="devOpIndicator" title="Supabase operation status">●</span>
        <span class="dev-op-label" id="devOpLabel">Idle</span>
      </div>
      <div class="dev-banner-right">
        <div class="dev-auth" id="devAuthControls">
          <span class="dev-auth-email" id="devAuthEmail">Not logged in</span>
          <button class="dev-auth-btn" id="devAuthLogin">Login</button>
          <button class="dev-auth-btn" id="devAuthLogout">Logout</button>
        </div>
        <label class="dev-toggle-switch">
          <input type="checkbox" id="devModeToggle" />
          <span class="dev-toggle-slider"></span>
        </label>
        <span class="dev-banner-label">Local Dev Mode</span>
        <button id="devModeRefresh" class="dev-refresh-btn" title="Reload page to apply changes">↻</button>
      </div>
    </div>
  `;

  document.body.prepend(banner);
  injectBannerStyles();
  installSupabaseFetchProbe();
  wireDevAuthControls();
}

/**
 * Inject banner CSS styles
 */
function injectBannerStyles() {
  if (document.getElementById('devModeBannerStyles')) return;

  const style = document.createElement('style');
  style.id = 'devModeBannerStyles';
  style.textContent = `
    #devModeBanner {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 48px;
      background: linear-gradient(135deg, #3549a5 0%, #6b2db0 100%);
      color: white;
      z-index: 999999;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 15px;
      display: flex;
      align-items: center;
      padding: 0 20px;
      opacity: 0.9;
      pointer-events: none;
    }

    .dev-banner-content {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      max-width: 1400px;
      margin: 0 auto;
    }

    .dev-banner-left,
    .dev-banner-right {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    /* Hide dev-banner auth pills so only the main header user menu shows */
    .dev-auth {
      display: none !important;
    }

    .dev-auth {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 2px 8px;
      background: rgba(255,255,255,0.15);
      border-radius: 6px;
      border: 1px solid rgba(255,255,255,0.25);
    }

    .dev-auth-email {
      font-weight: 600;
      font-size: 12px;
      color: #fefefe;
      max-width: 240px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .dev-auth-btn {
      background: rgba(255,255,255,0.2);
      border: 1px solid rgba(255,255,255,0.4);
      color: #fff;
      border-radius: 4px;
      padding: 4px 8px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
    }

    .dev-op-indicator {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: #999;
      box-shadow: 0 0 0 2px rgba(255,255,255,0.7), 0 0 12px rgba(255,255,255,0.5);
    }

    .dev-op-label {
      font-weight: 800;
      font-size: 14px;
      letter-spacing: 0.4px;
      color: #fdfdfd;
      text-transform: uppercase;
    }

    .dev-banner-icon {
      font-size: 22px;
    }

    .dev-banner-text {
      font-weight: 700;
      font-size: 15px;
    }

    #devModeStatus {
      font-weight: 700;
      text-decoration: underline;
      padding: 2px 6px;
      border-radius: 4px;
      background: rgba(255,255,255,0.2);
    }

    #devModeStatus.local {
      background: rgba(255, 193, 7, 0.3);
    }

    .dev-banner-label {
      font-weight: 600;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .dev-toggle-switch {
      position: relative;
      display: inline-block;
      width: 44px;
      height: 22px;
      margin: 0;
    }

    .dev-toggle-switch input {
      opacity: 0;
      width: 0;
      height: 0;
    }

    .dev-toggle-slider {
      position: absolute;
      cursor: pointer;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(255,255,255,0.3);
      transition: 0.3s;
      border-radius: 22px;
    }

    .dev-toggle-slider:before {
      position: absolute;
      content: "";
      height: 16px;
      width: 16px;
      left: 3px;
      bottom: 3px;
      background-color: white;
      transition: 0.3s;
      border-radius: 50%;
    }

    .dev-toggle-switch input:checked + .dev-toggle-slider {
      background-color: #ffc107;
    }

    .dev-toggle-switch input:checked + .dev-toggle-slider:before {
      transform: translateX(22px);
    }

    .dev-refresh-btn {
      background: rgba(255,255,255,0.2);
      border: 1px solid rgba(255,255,255,0.4);
      color: white;
      border-radius: 4px;
      padding: 4px 10px;
      cursor: pointer;
      font-size: 16px;
      font-weight: bold;
      transition: all 0.2s;
    }

    .dev-refresh-btn:hover {
      background: rgba(255,255,255,0.3);
      transform: rotate(180deg);
    }

    /* Adjust body padding to account for banner */
    body {
      padding-top: 48px !important;
    }

    /* Animation for status change */
    @keyframes statusPulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }

    #devModeStatus.changing {
      animation: statusPulse 0.5s ease-in-out;
    }
  `;

  document.head.appendChild(style);
}

function installSupabaseFetchProbe() {
  if (window._devModeFetchPatched) return;
  const originalFetch = window.fetch;
  if (typeof originalFetch !== 'function') return;

  const supabaseHost = (() => {
    try {
      if (window.ENV?.SUPABASE_URL) return new URL(window.ENV.SUPABASE_URL).host;
    } catch {}
    return 'supabase.co';
  })();

  window.fetch = async function patchedFetch(resource, options = {}) {
    const url = typeof resource === 'string' ? resource : (resource?.url || '');
    const isSupabase = url.includes(supabaseHost);
    const method = (options.method || (resource && resource.method) || 'GET').toUpperCase();
    const opType = method === 'GET' ? 'read' : 'write';

    if (isSupabase) {
      setDevOpIndicator({ opType, status: 'pending' });
    }

    try {
      const response = await originalFetch(resource, options);
      if (isSupabase) {
        const ok = response.ok;
        setDevOpIndicator({ opType, status: ok ? 'success' : 'error' });
      }
      return response;
    } catch (err) {
      if (isSupabase) {
        setDevOpIndicator({ opType, status: 'error' });
      }
      throw err;
    }
  };

  window._devModeFetchPatched = true;
}

function wireDevAuthControls() {
  const emailLabel = document.getElementById('devAuthEmail');
  const loginBtn = document.getElementById('devAuthLogin');
  const logoutBtn = document.getElementById('devAuthLogout');

  const renderEmail = () => {
    if (!emailLabel) return;
    let text = 'Not logged in';
    try {
      const raw = localStorage.getItem('supabase_session');
      if (raw) {
        const session = JSON.parse(raw);
        const email = session?.user?.email || session?.email;
        if (email) {
          text = `Signed in: ${email}`;
        }
      }
    } catch (e) {
      console.warn('Auth email render failed', e);
    }
    emailLabel.textContent = text;
  };

  renderEmail();

  window.addEventListener('storage', (e) => {
    if (e.key === 'supabase_session') {
      renderEmail();
    }
  });

  if (loginBtn) {
    loginBtn.addEventListener('click', () => {
      window.location.href = 'auth.html';
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      try {
        localStorage.removeItem('supabase_session');
        renderEmail();
        alert('Logged out locally.');
      } catch (e) {
        console.warn('Local logout failed', e);
      }
    });
  }
}

function setDevOpIndicator({ opType = 'read', status = 'pending' }) {
  const dot = document.getElementById('devOpIndicator');
  const label = document.getElementById('devOpLabel');
  if (!dot || !label) return;

  let color = '#999';
  let text = 'Idle';

  const isWrite = opType === 'write';

  if (status === 'pending') {
    color = '#f0ad4e';
    text = isWrite ? 'Write...' : 'Read...';
  } else if (status === 'success') {
    color = isWrite ? '#2ecc71' : '#2c7be5';
    text = isWrite ? 'Write OK' : 'Read OK';
  } else if (status === 'error') {
    color = '#e74c3c';
    text = isWrite ? 'Write Error' : 'Read Error';
  }

  dot.style.background = color;
  label.textContent = text;
}

/**
 * Update banner to reflect current state
 */
function updateBannerState() {
  const isLocalMode = isLocalDevModeEnabled();
  const statusEl = document.getElementById('devModeStatus');
  const toggleEl = document.getElementById('devModeToggle');

  if (statusEl) {
    statusEl.textContent = isLocalMode ? 'Local Storage' : 'Supabase';
    statusEl.classList.toggle('local', isLocalMode);
  }

  if (toggleEl) {
    toggleEl.checked = isLocalMode;
  }
}

/**
 * Attach event listeners
 */
function attachEventListeners() {
  const toggleEl = document.getElementById('devModeToggle');
  const refreshBtn = document.getElementById('devModeRefresh');

  if (toggleEl) {
    toggleEl.addEventListener('change', (e) => {
      const enabled = e.target.checked;
      setLocalDevModeEnabled(enabled);
      
      // Animate status change
      const statusEl = document.getElementById('devModeStatus');
      if (statusEl) {
        statusEl.classList.add('changing');
        setTimeout(() => {
          updateBannerState();
          statusEl.classList.remove('changing');
        }, 250);
      }
      
      // Show refresh button feedback
      if (refreshBtn) {
        refreshBtn.style.animation = 'statusPulse 0.5s ease-in-out';
        setTimeout(() => {
          refreshBtn.style.animation = '';
        }, 500);
      }
    });
  }

  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      window.location.reload();
    });
  }
}

/**
 * Programmatically update the banner (call after mode changes elsewhere)
 */
export function refreshBannerState() {
  updateBannerState();
}
