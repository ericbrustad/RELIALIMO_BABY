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
      </div>
      <div class="dev-banner-right">
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
      height: 36px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      z-index: 999999;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
      display: flex;
      align-items: center;
      padding: 0 16px;
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

    .dev-banner-icon {
      font-size: 18px;
    }

    .dev-banner-text {
      font-weight: 500;
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
      padding-top: 36px !important;
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
