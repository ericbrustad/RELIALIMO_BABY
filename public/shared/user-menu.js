import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getSupabaseCredentials, getSupabaseAuthUrl } from './supabase-config.js';
import { testSupabaseConnection } from './supabase-client.js';
import { getLastApiError } from './api-service.js';

let supabase = null;

function safeText(value) {
  return (value ?? '').toString();
}

function getInitials(email) {
  const s = safeText(email).trim();
  if (!s) return '?';
  return s[0].toUpperCase();
}

function getRole(user) {
  return (
    user?.role ||
    user?.user_metadata?.role ||
    user?.app_metadata?.role ||
    ''
  );
}

function ensureStyles() {
  const id = 'user-menu-styles';
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = 'user-menu.css';
  document.head?.appendChild(link);
}

function ensureContainer() {
  let container = document.getElementById('userMenuContainer');
  
  if (!container) {
    container = document.createElement('div');
    container.id = 'userMenuContainer';
  } else if (container.parentElement && container.parentElement !== document.body) {
    container.parentElement.removeChild(container);
  }

  // Fixed overlay in the top-right corner
  container.classList.add('user-menu-overlay');
  container.classList.remove('user-menu-floating');
  document.body.appendChild(container);

  return container;
}

// Clock functionality
const CLOCK_STYLES = {
  'digital-modern': { type: 'digital', name: 'Digital Modern', format: '24h' },
  'digital-classic': { type: 'digital', name: 'Digital Classic', format: '12h' },
  'digital-minimal': { type: 'digital', name: 'Digital Minimal', format: 'time-only' },
  'analog-classic': { type: 'analog', name: 'Analog Classic', style: 'classic' },
  'analog-modern': { type: 'analog', name: 'Analog Modern', style: 'modern' },
  'analog-minimal': { type: 'analog', name: 'Analog Minimal', style: 'minimal' }
};

function getClockStyle() {
  return localStorage.getItem('clockStyle') || 'digital-modern';
}

function setClockStyle(style) {
  localStorage.setItem('clockStyle', style);
  updateClockDisplay();
}

function formatTime(date, format) {
  const hours24 = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();
  const hours12 = hours24 % 12 || 12;
  const ampm = hours24 >= 12 ? 'PM' : 'AM';
  const pad = n => n.toString().padStart(2, '0');
  
  switch (format) {
    case '24h':
      return `${pad(hours24)}:${pad(minutes)}:${pad(seconds)}`;
    case '12h':
      return `${hours12}:${pad(minutes)}:${pad(seconds)} ${ampm}`;
    case 'time-only':
      return `${pad(hours24)}:${pad(minutes)}`;
    default:
      return `${pad(hours24)}:${pad(minutes)}:${pad(seconds)}`;
  }
}

function formatDate(date) {
  const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
  return date.toLocaleDateString('en-US', options);
}

function renderAnalogClock(date, style) {
  const hours = date.getHours() % 12;
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();
  
  const hourDeg = (hours * 30) + (minutes * 0.5);
  const minuteDeg = minutes * 6;
  const secondDeg = seconds * 6;
  
  const styleClass = `analog-${style}`;
  const showSeconds = style !== 'minimal';
  
  return `
    <div class="analog-clock ${styleClass}" title="Click to change clock style">
      <div class="clock-face">
        ${style === 'classic' ? '<div class="clock-markers"></div>' : ''}
        <div class="hand hour-hand" style="transform: rotate(${hourDeg}deg)"></div>
        <div class="hand minute-hand" style="transform: rotate(${minuteDeg}deg)"></div>
        ${showSeconds ? `<div class="hand second-hand" style="transform: rotate(${secondDeg}deg)"></div>` : ''}
        <div class="clock-center"></div>
      </div>
    </div>
  `;
}

function updateClockDisplay() {
  const clockContainer = document.getElementById('headerClock');
  if (!clockContainer) return;
  
  const now = new Date();
  const styleName = getClockStyle();
  const styleConfig = CLOCK_STYLES[styleName] || CLOCK_STYLES['digital-modern'];
  
  if (styleConfig.type === 'digital') {
    const timeStr = formatTime(now, styleConfig.format);
    const dateStr = styleConfig.format !== 'time-only' ? formatDate(now) : '';
    clockContainer.innerHTML = `
      <div class="digital-clock ${styleName}" title="Click to change clock style">
        <div class="clock-time">${timeStr}</div>
        ${dateStr ? `<div class="clock-date">${dateStr}</div>` : ''}
      </div>
    `;
  } else {
    clockContainer.innerHTML = `
      <div class="clock-wrapper" title="Click to change clock style">
        ${renderAnalogClock(now, styleConfig.style)}
        <div class="clock-date-small">${formatDate(now)}</div>
      </div>
    `;
  }
}

function startClock() {
  updateClockDisplay();
  setInterval(updateClockDisplay, 1000);
}

function cycleClockStyle() {
  const styles = Object.keys(CLOCK_STYLES);
  const current = getClockStyle();
  const currentIndex = styles.indexOf(current);
  const nextIndex = (currentIndex + 1) % styles.length;
  setClockStyle(styles[nextIndex]);
}

// =====================================================
// SYSTEM MONITOR (CPU/RAM)
// =====================================================
const SystemMonitor = {
  lastCpuTime: 0,
  lastIdleTime: 0,
  cpuHistory: [],
  updateInterval: null,
  isDragging: false,
  dragOffset: { x: 0, y: 0 },

  getSettings() {
    try {
      return JSON.parse(localStorage.getItem('sysMonitorSettings') || '{}');
    } catch {
      return {};
    }
  },

  saveSettings(settings) {
    const current = this.getSettings();
    localStorage.setItem('sysMonitorSettings', JSON.stringify({ ...current, ...settings }));
  },

  init() {
    const widget = document.getElementById('systemMonitorWidget');
    if (!widget) return;

    const settings = this.getSettings();
    
    // Show/hide based on settings
    if (settings.visible) {
      widget.style.display = 'flex';
    }

    // Apply saved position if draggable and position exists
    if (settings.draggable && settings.position) {
      widget.style.position = 'fixed';
      widget.style.left = settings.position.x + 'px';
      widget.style.top = settings.position.y + 'px';
      widget.style.zIndex = '9999';
    }

    // Apply size
    if (settings.size) {
      widget.style.transform = `scale(${settings.size / 100})`;
    }

    // Setup dragging if enabled
    if (settings.draggable) {
      this.setupDragging(widget);
    }

    // Start monitoring
    this.startMonitoring();
  },

  setupDragging(widget) {
    widget.style.cursor = 'move';
    
    widget.addEventListener('mousedown', (e) => {
      if (e.target.closest('button')) return;
      this.isDragging = true;
      const rect = widget.getBoundingClientRect();
      this.dragOffset = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
      widget.style.position = 'fixed';
      widget.style.zIndex = '99999';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      const x = e.clientX - this.dragOffset.x;
      const y = e.clientY - this.dragOffset.y;
      widget.style.left = x + 'px';
      widget.style.top = y + 'px';
      widget.style.right = 'auto';
      widget.style.bottom = 'auto';
    });

    document.addEventListener('mouseup', () => {
      if (this.isDragging) {
        this.isDragging = false;
        const rect = widget.getBoundingClientRect();
        this.saveSettings({ position: { x: rect.left, y: rect.top } });
      }
    });

    // Double-click to reset position
    widget.addEventListener('dblclick', () => {
      widget.style.position = '';
      widget.style.left = '';
      widget.style.top = '';
      widget.style.right = '';
      widget.style.bottom = '';
      this.saveSettings({ position: null });
    });
  },

  startMonitoring() {
    // Update immediately
    this.updateMetrics();
    
    // Update every 2 seconds
    this.updateInterval = setInterval(() => this.updateMetrics(), 2000);
  },

  async updateMetrics() {
    const settings = this.getSettings();
    const widget = document.getElementById('systemMonitorWidget');
    if (!widget || !settings.visible) return;

    // CPU estimation using performance timing
    const cpuPercent = await this.estimateCpu();
    const ramPercent = this.getMemoryUsage();

    // Update CPU display
    if (settings.showCpu !== false) {
      const cpuBar = document.getElementById('cpuBar');
      const cpuValue = document.getElementById('cpuValue');
      if (cpuBar) {
        cpuBar.style.width = cpuPercent + '%';
        cpuBar.style.background = this.getColorForPercent(cpuPercent, 'cpu');
      }
      if (cpuValue) cpuValue.textContent = Math.round(cpuPercent) + '%';
      
      const cpuRow = widget.querySelector('.cpu-row');
      if (cpuRow) cpuRow.style.display = 'flex';
    } else {
      const cpuRow = widget.querySelector('.cpu-row');
      if (cpuRow) cpuRow.style.display = 'none';
    }

    // Update RAM display
    if (settings.showRam !== false) {
      const ramBar = document.getElementById('ramBar');
      const ramValue = document.getElementById('ramValue');
      if (ramBar) {
        ramBar.style.width = ramPercent + '%';
        ramBar.style.background = this.getColorForPercent(ramPercent, 'ram');
      }
      if (ramValue) {
        if (ramPercent > 0) {
          ramValue.textContent = Math.round(ramPercent) + '%';
        } else {
          ramValue.textContent = 'N/A';
        }
      }
      
      const ramRow = widget.querySelector('.ram-row');
      if (ramRow) ramRow.style.display = 'flex';
    } else {
      const ramRow = widget.querySelector('.ram-row');
      if (ramRow) ramRow.style.display = 'none';
    }
  },

  async estimateCpu() {
    // Use requestAnimationFrame timing to estimate CPU load
    return new Promise((resolve) => {
      const startTime = performance.now();
      let frames = 0;
      const measureFrames = () => {
        frames++;
        if (performance.now() - startTime < 100) {
          requestAnimationFrame(measureFrames);
        } else {
          // ~60fps = low CPU, fewer frames = higher CPU
          const fps = frames * 10;
          const cpuEstimate = Math.max(0, Math.min(100, 100 - (fps / 60 * 100) + 15));
          
          // Smooth with history
          this.cpuHistory.push(cpuEstimate);
          if (this.cpuHistory.length > 5) this.cpuHistory.shift();
          const avg = this.cpuHistory.reduce((a, b) => a + b, 0) / this.cpuHistory.length;
          
          resolve(Math.max(5, Math.min(95, avg)));
        }
      };
      requestAnimationFrame(measureFrames);
    });
  },

  getMemoryUsage() {
    // Use performance.memory if available (Chrome only)
    if (performance.memory) {
      const used = performance.memory.usedJSHeapSize;
      const total = performance.memory.jsHeapSizeLimit;
      return Math.round((used / total) * 100);
    }
    
    // Fallback: estimate based on DOM size
    const domNodes = document.querySelectorAll('*').length;
    const estimatedMB = domNodes * 0.005; // rough estimate
    const assumedTotalMB = 512;
    return Math.min(95, Math.round((estimatedMB / assumedTotalMB) * 100));
  },

  getColorForPercent(percent, type) {
    if (percent < 50) {
      return type === 'cpu' 
        ? 'linear-gradient(90deg, #10b981, #34d399)' 
        : 'linear-gradient(90deg, #3b82f6, #60a5fa)';
    } else if (percent < 75) {
      return 'linear-gradient(90deg, #f59e0b, #fbbf24)';
    } else {
      return 'linear-gradient(90deg, #ef4444, #f87171)';
    }
  },

  show() {
    const widget = document.getElementById('systemMonitorWidget');
    if (widget) {
      widget.style.display = 'flex';
      this.saveSettings({ visible: true });
    }
  },

  hide() {
    const widget = document.getElementById('systemMonitorWidget');
    if (widget) {
      widget.style.display = 'none';
      this.saveSettings({ visible: false });
    }
  },

  toggle() {
    const settings = this.getSettings();
    if (settings.visible) {
      this.hide();
    } else {
      this.show();
    }
  }
};

// Expose globally
window.SystemMonitor = SystemMonitor;

function renderSkeleton(container) {
  container.innerHTML = `
    <div class="user-menu-wrapper">
      <!-- Layout Toggle Buttons -->
      <div class="layout-toggle-inline" aria-label="Layout selector">
        <button type="button" id="inlineLayoutVertical" title="Vertical layout">⬛</button>
        <button type="button" id="inlineLayoutHorizontal" title="Horizontal layout">▬</button>
        <!-- Auto Farmout Mode Toggle -->
        <label class="auto-farmout-toggle" title="Automatic Farmout Mode - New reservations will auto-farm out">
          <input type="checkbox" id="autoFarmoutToggle">
          <span class="toggle-slider"></span>
          <span class="toggle-label">🏠 Auto Farm</span>
        </label>
        <span id="autoFarmoutIndicator" class="auto-farmout-indicator" style="display: none;">✅ Auto-Farmed</span>
        <span id="globalSupabaseBadge" class="supabase-status-badge admin-only inline-badge" title="Supabase connection status">Checking…</span>
      </div>

      <!-- Right side: User pill with clock below -->
      <div class="user-pill-stack">
        <button type="button" class="user-menu-toggle" aria-expanded="false" id="userMenuToggle">
          <span class="user-avatar" id="userMenuAvatar">?</span>
          <span class="user-email" id="userMenuEmail">...</span>
          <span class="menu-icon" aria-hidden="true">▼</span>
        </button>
        
        <!-- Clock Display below login pill -->
        <div id="headerClock" class="header-clock" onclick="window.cycleClockStyle && window.cycleClockStyle()"></div>
        
        <!-- System Monitor Widget -->
        <div id="systemMonitorWidget" class="system-monitor-widget" style="display: none;">
          <div class="sys-monitor-row cpu-row">
            <span class="sys-monitor-icon">🖥️</span>
            <div class="sys-monitor-bar-container">
              <div class="sys-monitor-bar cpu-bar" id="cpuBar"></div>
            </div>
            <span class="sys-monitor-value" id="cpuValue">0%</span>
          </div>
          <div class="sys-monitor-row ram-row">
            <span class="sys-monitor-icon">💾</span>
            <div class="sys-monitor-bar-container">
              <div class="sys-monitor-bar ram-bar" id="ramBar"></div>
            </div>
            <span class="sys-monitor-value" id="ramValue">0%</span>
          </div>
        </div>
        
        <!-- Farmout Offer Countdown Timer -->
        <div id="farmoutCountdownTimer" class="farmout-countdown-timer" style="display: none;">
          <div class="countdown-chime-icon">🔔</div>
          <div class="countdown-info">
            <div class="countdown-driver-name" id="countdownDriverName"></div>
            <div class="countdown-company" id="countdownCompany"></div>
            <div class="countdown-time" id="countdownTime">00:00</div>
            <div class="countdown-label">until next offer</div>
          </div>
        </div>

        <div class="user-menu-dropdown" id="userMenuDropdown" style="display:none;">
          <div class="menu-header">
            <div class="menu-user-info">
              <div class="menu-avatar" id="userMenuAvatarBig">?</div>
              <div>
                <div class="menu-email" id="userMenuEmailBig">...</div>
                <div class="menu-role" id="userMenuRole">&nbsp;</div>
              </div>
            </div>
          </div>

          <div class="menu-divider"></div>

          <button type="button" class="menu-item" id="userMenuSignIn" style="display:none;">
            <span class="menu-icon">🔑</span>
            <span>Sign in</span>
          </button>

          <button type="button" class="menu-item menu-item-danger" id="userMenuLogout">
            <span class="menu-icon">⏻</span>
            <span>Log out</span>
          </button>
        </div>
      </div>
    </div>
  `;
}

function setMenuState({ email, role, signedIn }) {
  const emailText = signedIn ? email : 'Not signed in';

  const avatar = document.getElementById('userMenuAvatar');
  const avatarBig = document.getElementById('userMenuAvatarBig');
  const emailEl = document.getElementById('userMenuEmail');
  const emailBig = document.getElementById('userMenuEmailBig');
  const roleEl = document.getElementById('userMenuRole');

  if (avatar) avatar.textContent = getInitials(email);
  if (avatarBig) avatarBig.textContent = getInitials(email);
  if (emailEl) emailEl.textContent = emailText;
  if (emailBig) emailBig.textContent = signedIn ? email : 'Not signed in';
  if (roleEl) roleEl.textContent = role ? `Role: ${role}` : (signedIn ? '' : '');

  const signInBtn = document.getElementById('userMenuSignIn');
  const logoutBtn = document.getElementById('userMenuLogout');
  if (signInBtn) signInBtn.style.display = signedIn ? 'none' : 'flex';
  if (logoutBtn) logoutBtn.style.display = signedIn ? 'flex' : 'none';

  // Show/hide global Supabase badge for admins
  try {
    const badge = document.getElementById('globalSupabaseBadge');
    const isAdmin = (role || '').toString().toLowerCase() === 'admin';
    if (badge) {
      badge.classList.toggle('admin-only', !isAdmin);
      if (isAdmin) {
        // Wire manual check
        badge.addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          try { await updateGlobalSupabaseBadge(); } catch(_) {}
        }, { once: false });

        // Initialize status
        updateGlobalSupabaseBadge().catch(() => {});
      }
    }
  } catch (e) {
    // non-fatal
  }
}

// Update the inline global Supabase badge (admin-only)
export async function updateGlobalSupabaseBadge() {
  try {
    const el = document.getElementById('globalSupabaseBadge');
    if (!el) return;

    el.classList.remove('ok','fail','warn');
    el.textContent = 'Checking…';

    try {
      const ok = await testSupabaseConnection();
      if (ok) {
        el.classList.add('ok');
        const u = (typeof window !== 'undefined' && window.ENV && window.ENV.SUPABASE_URL) ? window.ENV.SUPABASE_URL : 'unknown';
        try { const host = new URL(u).hostname; el.title = `Supabase: ${host}`; } catch { el.title = `Supabase: ${u}`; }
        el.textContent = 'Supabase: connected';
      } else {
        el.classList.add('fail');
        el.title = 'Supabase: disconnected';
        el.textContent = 'Supabase: disconnected';
      }
    } catch (err) {
      el.classList.add('fail');
      el.title = err && err.message ? err.message : 'Connection error';
      el.textContent = 'Supabase: error';
    }
  } catch (err) {
    // ignore
  }
}


function wireInteractions() {
  const toggleBtn = document.getElementById('userMenuToggle');
  const dropdown = document.getElementById('userMenuDropdown');
  if (!toggleBtn || !dropdown) return;

  const close = () => {
    dropdown.style.display = 'none';
    toggleBtn.classList.remove('active');
    toggleBtn.setAttribute('aria-expanded', 'false');
  };

  const open = () => {
    dropdown.style.display = 'block';
    toggleBtn.classList.add('active');
    toggleBtn.setAttribute('aria-expanded', 'true');
  };

  toggleBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const isOpen = dropdown.style.display !== 'none';
    if (isOpen) close(); else open();
  });

  document.addEventListener('click', (e) => {
    if (e.target?.closest?.('.user-menu-wrapper')) return;
    close();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });

  const signInBtn = document.getElementById('userMenuSignIn');
  if (signInBtn) {
    signInBtn.addEventListener('click', () => {
      window.location.href = 'auth.html';
    });
  }

  const logoutBtn = document.getElementById('userMenuLogout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        // Sign out SDK session (used by auth-guard)
        if (supabase?.auth?.signOut) {
          await supabase.auth.signOut();
        }
      } catch {
        // ignore
      }

      try {
        // Also clear REST-client session keys if used elsewhere
        const mod = await import('./supabase-client.js');
        if (mod?.signOut) {
          await mod.signOut();
        }
      } catch {
        // ignore
      }

      // Clear global badge interval if set
      try { if (window._globalSupabaseStatusInterval) { clearInterval(window._globalSupabaseStatusInterval); delete window._globalSupabaseStatusInterval; } } catch(_){}

      window.location.href = 'auth.html';
    });
  }

  // Wire up inline layout toggle buttons
  wireLayoutToggle();
}

function wireLayoutToggle() {
  const vertBtn = document.getElementById('inlineLayoutVertical');
  const horzBtn = document.getElementById('inlineLayoutHorizontal');

  function setLayout(mode) {
    const normalized = mode === 'horizontal' ? 'horizontal' : 'vertical';
    localStorage.setItem('headerLayout', normalized);
    document.documentElement.setAttribute('data-layout', normalized);
    if (vertBtn) vertBtn.classList.toggle('active', normalized === 'vertical');
    if (horzBtn) horzBtn.classList.toggle('active', normalized === 'horizontal');

    // Also update any legacy toggle buttons in parent/top frame
    try {
      const doc = window.top?.document || document;
      doc.querySelectorAll('.layout-toggle button').forEach(btn => {
        const isVertical = btn.id === 'layoutVertical';
        btn.classList.toggle('active', isVertical ? normalized === 'vertical' : normalized === 'horizontal');
      });
    } catch { /* cross-origin */ }
  }

  // Initialize from stored preference
  const saved = localStorage.getItem('headerLayout') || 'vertical';
  setLayout(saved);

  if (vertBtn) vertBtn.addEventListener('click', () => setLayout('vertical'));
  if (horzBtn) horzBtn.addEventListener('click', () => setLayout('horizontal'));

  // Wire up Auto Farmout toggle
  wireAutoFarmoutToggle();

  // Also expose a global function to trigger badge update from other UI
  window.updateGlobalSupabaseBadge = updateGlobalSupabaseBadge;
}

// Auto Farmout Mode Toggle
function wireAutoFarmoutToggle() {
  const toggle = document.getElementById('autoFarmoutToggle');
  const indicator = document.getElementById('autoFarmoutIndicator');
  
  if (!toggle) return;
  
  // Initialize from stored preference
  const isEnabled = localStorage.getItem('autoFarmoutMode') === 'true';
  toggle.checked = isEnabled;
  updateAutoFarmoutUI(isEnabled);
  
  // Handle toggle change
  toggle.addEventListener('change', () => {
    const enabled = toggle.checked;
    localStorage.setItem('autoFarmoutMode', enabled ? 'true' : 'false');
    updateAutoFarmoutUI(enabled);
    
    // Broadcast to all frames
    try {
      const frames = [window, window.parent, window.top];
      frames.forEach(frame => {
        try {
          frame.postMessage({ type: 'autoFarmoutModeChanged', enabled }, '*');
        } catch (e) { /* cross-origin */ }
      });
    } catch (e) { /* ignore */ }
  });
  
  // Listen for messages from other frames
  window.addEventListener('message', (event) => {
    if (event.data?.type === 'autoFarmoutModeChanged') {
      toggle.checked = event.data.enabled;
      updateAutoFarmoutUI(event.data.enabled);
    }
  });
  
  // Expose global getter
  window.isAutoFarmoutMode = () => localStorage.getItem('autoFarmoutMode') === 'true';
}

function updateAutoFarmoutUI(enabled) {
  const indicator = document.getElementById('autoFarmoutIndicator');
  if (indicator) {
    indicator.style.display = enabled ? 'inline-flex' : 'none';
  }
  
  // Update Reservations button badge in all frames
  try {
    const frames = [document, window.parent?.document, window.top?.document].filter(Boolean);
    frames.forEach(doc => {
      try {
        const reservationsBtn = doc.querySelector('[data-section="reservations"]');
        if (reservationsBtn) {
          let badge = reservationsBtn.querySelector('.auto-farmout-badge');
          if (enabled) {
            if (!badge) {
              badge = doc.createElement('span');
              badge.className = 'auto-farmout-badge';
              badge.textContent = '🏠';
              badge.title = 'Auto Farmout Mode Active';
              reservationsBtn.style.position = 'relative';
              reservationsBtn.appendChild(badge);
            }
          } else if (badge) {
            badge.remove();
          }
        }
      } catch (e) { /* cross-origin */ }
    });
  } catch (e) { /* ignore */ }
}

async function refreshUser() {
  try {
    if (!supabase) return;
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      setMenuState({ email: '', role: '', signedIn: false });
      return;
    }

    const user = data?.user;
    if (!user) {
      setMenuState({ email: '', role: '', signedIn: false });
      return;
    }

    setMenuState({
      email: safeText(user.email),
      role: safeText(getRole(user)),
      signedIn: true
    });

    // If admin, ensure global badge updates periodically
    try {
      const isAdmin = (getRole(user) || '').toString().toLowerCase() === 'admin';
      if (isAdmin) {
        if (typeof window !== 'undefined') {
          if (!window._globalSupabaseStatusInterval) {
            window._globalSupabaseStatusInterval = setInterval(() => {
              try { if (typeof updateGlobalSupabaseBadge === 'function') updateGlobalSupabaseBadge().catch(()=>{}); } catch(_){}
            }, 60_000);
          }
        }
      }
    } catch (_) {}
  } catch {
    setMenuState({ email: '', role: '', signedIn: false });
  }
}

// Expose cycleClockStyle globally for onclick handler
window.cycleClockStyle = cycleClockStyle;

// ===================================
// WIDGET SETTINGS SUPPORT
// ===================================
const widgetSettings = {
  timerAlwaysVisible: false,
  timerDraggable: true,
  timerPlayChime: true,
  timerSize: 100,
  timerTheme: 'amber',
  timerPosition: null,
  clockVisible: true,
  clockDraggable: false,
  clockSize: 100,
  clockTextColor: '#1f2937',
  clockPosition: null
};

function loadWidgetSettings() {
  try {
    const saved = localStorage.getItem('widgetSettings');
    if (saved) {
      Object.assign(widgetSettings, JSON.parse(saved));
    }
  } catch (e) {
    console.warn('[WidgetSettings] Failed to load:', e);
  }
  return widgetSettings;
}

function applyWidgetSettings() {
  loadWidgetSettings();
  
  const timerEl = document.getElementById('farmoutCountdownTimer');
  const clockEl = document.getElementById('headerClock');
  
  // Apply timer settings
  if (timerEl) {
    // Size
    timerEl.style.transform = `scale(${widgetSettings.timerSize / 100})`;
    timerEl.style.transformOrigin = 'top right';
    
    // Theme colors
    applyTimerTheme(timerEl, widgetSettings.timerTheme);
    
    // Always visible (idle mode)
    if (widgetSettings.timerAlwaysVisible && !farmoutCountdownState.active) {
      timerEl.style.display = 'flex';
      timerEl.style.opacity = '0.5';
      const driverNameEl = document.getElementById('countdownDriverName');
      const companyEl = document.getElementById('countdownCompany');
      const countdownTimeEl = document.getElementById('countdownTime');
      if (driverNameEl) driverNameEl.textContent = 'Waiting...';
      if (companyEl) companyEl.textContent = 'No active offers';
      if (countdownTimeEl) countdownTimeEl.textContent = '--:--';
    }
    
    // Position
    if (widgetSettings.timerPosition && widgetSettings.timerDraggable) {
      timerEl.style.position = 'fixed';
      timerEl.style.left = widgetSettings.timerPosition.x + 'px';
      timerEl.style.top = widgetSettings.timerPosition.y + 'px';
      timerEl.style.right = 'auto';
    }
    
    // Draggable
    if (widgetSettings.timerDraggable) {
      makeWidgetDraggable(timerEl, 'timer');
    }
  }
  
  // Apply clock settings
  if (clockEl) {
    // Visibility
    clockEl.style.display = widgetSettings.clockVisible ? 'block' : 'none';
    
    // Size
    clockEl.style.transform = `scale(${widgetSettings.clockSize / 100})`;
    clockEl.style.transformOrigin = 'top right';
    
    // Color (for digital clocks)
    clockEl.style.setProperty('--clock-text-color', widgetSettings.clockTextColor);
    
    // Position
    if (widgetSettings.clockPosition && widgetSettings.clockDraggable) {
      clockEl.style.position = 'fixed';
      clockEl.style.left = widgetSettings.clockPosition.x + 'px';
      clockEl.style.top = widgetSettings.clockPosition.y + 'px';
      clockEl.style.right = 'auto';
    }
    
    // Draggable
    if (widgetSettings.clockDraggable) {
      makeWidgetDraggable(clockEl, 'clock');
    }
  }
}

function applyTimerTheme(timerEl, theme) {
  // Remove existing theme classes
  timerEl.classList.remove('theme-amber', 'theme-blue', 'theme-green', 'theme-purple', 'theme-dark');
  
  // Apply theme-specific styles
  const themes = {
    amber: { bg: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', border: '#f59e0b' },
    blue: { bg: 'linear-gradient(135deg, #dbeafe 0%, #93c5fd 100%)', border: '#3b82f6' },
    green: { bg: 'linear-gradient(135deg, #dcfce7 0%, #86efac 100%)', border: '#22c55e' },
    purple: { bg: 'linear-gradient(135deg, #ede9fe 0%, #c4b5fd 100%)', border: '#8b5cf6' },
    dark: { bg: 'linear-gradient(135deg, #374151 0%, #1f2937 100%)', border: '#6b7280' }
  };
  
  const t = themes[theme] || themes.amber;
  timerEl.style.background = t.bg;
  timerEl.style.borderColor = t.border;
  
  if (theme !== 'amber') {
    timerEl.classList.add('theme-' + theme);
  }
}

function makeWidgetDraggable(element, widgetName) {
  let isDragging = false;
  let startX, startY, initialX, initialY;
  
  // Add drag cursor
  element.style.cursor = 'grab';
  
  // Add drag handle hint
  element.title = 'Drag to move. Double-click to reset position.';
  
  function onMouseDown(e) {
    if (e.button !== 0) return; // Only left click
    isDragging = true;
    element.style.cursor = 'grabbing';
    
    const rect = element.getBoundingClientRect();
    startX = e.clientX;
    startY = e.clientY;
    initialX = rect.left;
    initialY = rect.top;
    
    e.preventDefault();
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }
  
  function onMouseMove(e) {
    if (!isDragging) return;
    
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    
    element.style.position = 'fixed';
    element.style.left = (initialX + dx) + 'px';
    element.style.top = (initialY + dy) + 'px';
    element.style.right = 'auto';
  }
  
  function onMouseUp(e) {
    if (!isDragging) return;
    isDragging = false;
    element.style.cursor = 'grab';
    
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    
    // Save position
    const rect = element.getBoundingClientRect();
    const position = { x: rect.left, y: rect.top };
    
    try {
      loadWidgetSettings();
      if (widgetName === 'timer') {
        widgetSettings.timerPosition = position;
      } else if (widgetName === 'clock') {
        widgetSettings.clockPosition = position;
      }
      localStorage.setItem('widgetSettings', JSON.stringify(widgetSettings));
    } catch (e) {
      console.warn('[WidgetSettings] Failed to save position:', e);
    }
  }
  
  function onDoubleClick(e) {
    // Reset position
    element.style.position = '';
    element.style.left = '';
    element.style.top = '';
    element.style.right = '';
    
    try {
      loadWidgetSettings();
      if (widgetName === 'timer') {
        widgetSettings.timerPosition = null;
      } else if (widgetName === 'clock') {
        widgetSettings.clockPosition = null;
      }
      localStorage.setItem('widgetSettings', JSON.stringify(widgetSettings));
    } catch (e) {
      console.warn('[WidgetSettings] Failed to reset position:', e);
    }
  }
  
  element.addEventListener('mousedown', onMouseDown);
  element.addEventListener('dblclick', onDoubleClick);
}

// ===================================
// FARMOUT COUNTDOWN TIMER
// ===================================
const farmoutCountdownState = {
  active: false,
  driverName: '',
  company: '',
  expiresAt: null,
  intervalId: null,
  chimeAudio: null
};

function playFarmoutChime() {
  // Check if chime is enabled in settings
  loadWidgetSettings();
  if (!widgetSettings.timerPlayChime) {
    console.log('[FarmoutCountdown] Chime disabled in settings');
    return;
  }
  
  try {
    // Create a simple chime using Web Audio API
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // First chime tone
    const oscillator1 = audioContext.createOscillator();
    const gainNode1 = audioContext.createGain();
    oscillator1.connect(gainNode1);
    gainNode1.connect(audioContext.destination);
    oscillator1.frequency.value = 880; // A5 note
    oscillator1.type = 'sine';
    gainNode1.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode1.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    oscillator1.start(audioContext.currentTime);
    oscillator1.stop(audioContext.currentTime + 0.3);
    
    // Second chime tone (slightly delayed)
    setTimeout(() => {
      const oscillator2 = audioContext.createOscillator();
      const gainNode2 = audioContext.createGain();
      oscillator2.connect(gainNode2);
      gainNode2.connect(audioContext.destination);
      oscillator2.frequency.value = 1174.66; // D6 note
      oscillator2.type = 'sine';
      gainNode2.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
      oscillator2.start(audioContext.currentTime);
      oscillator2.stop(audioContext.currentTime + 0.4);
    }, 150);
    
  } catch (e) {
    console.warn('Could not play farmout chime:', e);
  }
}

function formatCountdownTime(msRemaining) {
  if (!Number.isFinite(msRemaining) || msRemaining <= 0) {
    return '00:00';
  }
  const totalSeconds = Math.ceil(msRemaining / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function updateCountdownDisplay() {
  const timerEl = document.getElementById('farmoutCountdownTimer');
  const countdownTimeEl = document.getElementById('countdownTime');
  const driverNameEl = document.getElementById('countdownDriverName');
  const companyEl = document.getElementById('countdownCompany');
  
  if (!timerEl || !farmoutCountdownState.active) {
    // Check if timer should stay visible when idle
    loadWidgetSettings();
    if (timerEl && widgetSettings.timerAlwaysVisible) {
      timerEl.style.display = 'flex';
      timerEl.style.opacity = '0.5';
      if (driverNameEl) driverNameEl.textContent = 'Waiting...';
      if (companyEl) companyEl.textContent = 'No active offers';
      if (countdownTimeEl) countdownTimeEl.textContent = '--:--';
    } else if (timerEl) {
      timerEl.style.display = 'none';
    }
    return;
  }
  
  const now = Date.now();
  const msRemaining = farmoutCountdownState.expiresAt - now;
  
  if (msRemaining <= 0) {
    // Timer expired
    stopFarmoutCountdown();
    return;
  }
  
  timerEl.style.display = 'flex';
  timerEl.style.opacity = '1';
  if (driverNameEl) driverNameEl.textContent = farmoutCountdownState.driverName || 'Driver';
  if (companyEl) companyEl.textContent = farmoutCountdownState.company || '';
  if (countdownTimeEl) countdownTimeEl.textContent = formatCountdownTime(msRemaining);
  
  // Add urgent class when under 60 seconds
  if (msRemaining <= 60000) {
    timerEl.classList.add('urgent');
  } else {
    timerEl.classList.remove('urgent');
  }
}

function startFarmoutCountdown(driverName, company, expiresAt) {
  // Stop any existing countdown
  stopFarmoutCountdown();
  
  farmoutCountdownState.active = true;
  farmoutCountdownState.driverName = driverName || 'Driver';
  farmoutCountdownState.company = company || '';
  farmoutCountdownState.expiresAt = typeof expiresAt === 'number' ? expiresAt : new Date(expiresAt).getTime();
  
  // Play chime sound
  playFarmoutChime();
  
  // Update display immediately
  updateCountdownDisplay();
  
  // Update every second
  farmoutCountdownState.intervalId = setInterval(updateCountdownDisplay, 1000);
  
  console.log('[FarmoutCountdown] Started countdown for', driverName, 'until', new Date(farmoutCountdownState.expiresAt).toISOString());
}

function stopFarmoutCountdown() {
  farmoutCountdownState.active = false;
  farmoutCountdownState.driverName = '';
  farmoutCountdownState.company = '';
  farmoutCountdownState.expiresAt = null;
  
  if (farmoutCountdownState.intervalId) {
    clearInterval(farmoutCountdownState.intervalId);
    farmoutCountdownState.intervalId = null;
  }
  
  const timerEl = document.getElementById('farmoutCountdownTimer');
  if (timerEl) timerEl.style.display = 'none';
}

// Listen for farmout offer events to start the countdown
function initFarmoutCountdownListener() {
  window.addEventListener('farmoutOfferSent', (e) => {
    const detail = e.detail || {};
    const driverName = detail.driverName || 'Driver';
    const company = detail.driverCompany || detail.offerDetails?.affiliateName || '';
    const dispatchInterval = detail.dispatchIntervalMinutes || detail.offerDetails?.dispatchIntervalMinutes || 15;
    const expiresAt = Date.now() + (dispatchInterval * 60 * 1000);
    
    console.log('[FarmoutCountdown] Offer sent event received:', detail);
    startFarmoutCountdown(driverName, company, expiresAt);
  });
  
  // Also listen for offer accepted/declined to stop countdown
  window.addEventListener('farmoutOfferAccepted', () => {
    console.log('[FarmoutCountdown] Offer accepted, stopping countdown');
    stopFarmoutCountdown();
  });
  
  window.addEventListener('farmoutOfferDeclined', () => {
    console.log('[FarmoutCountdown] Offer declined, stopping countdown');
    stopFarmoutCountdown();
  });
  
  window.addEventListener('farmoutJobStopped', () => {
    console.log('[FarmoutCountdown] Farmout job stopped, stopping countdown');
    stopFarmoutCountdown();
  });
}

// Expose for external access
window.startFarmoutCountdown = startFarmoutCountdown;
window.stopFarmoutCountdown = stopFarmoutCountdown;

async function init() {
  // Avoid duplicate pills when running inside an iframe - parent window will have its own
  try {
    if (window.self !== window.top) {
      // Always skip in iframes - the parent index.html handles the user menu and clock
      console.log('[user-menu] Running in iframe, skipping user menu to avoid duplicates');
      return;
    }
  } catch {
    // Cross-origin or other access issue; continue locally
  }

  ensureStyles();
  const container = ensureContainer();
  if (!container) return;

  renderSkeleton(container);
  
  // Start the clock
  startClock();
  
  // Initialize system monitor
  SystemMonitor.init();
  
  // Initialize farmout countdown listener
  initFarmoutCountdownListener();
  
  // Apply widget settings (size, position, theme, draggability)
  applyWidgetSettings();
  
  // Listen for widget settings changes from iframes (e.g., widget-settings page)
  window.addEventListener('message', (event) => {
    if (event.data?.type === 'widgetSettingsChanged') {
      console.log('[user-menu] Received widget settings change from iframe, reloading...');
      applyWidgetSettings();
    }
  });

  try {
    const { anonKey } = getSupabaseCredentials();
    const url = getSupabaseAuthUrl(); // use direct Supabase URL for auth client
    supabase = createClient(url, anonKey);

    // Wire the global badge updater for admin if present now (best-effort)
    try { if (typeof updateGlobalSupabaseBadge === 'function') updateGlobalSupabaseBadge().catch(()=>{}); } catch(_) {}

  } catch {
    supabase = null;
  }

  wireInteractions();
  await refreshUser();

  // Live updates when session changes
  try {
    supabase?.auth?.onAuthStateChange?.(() => {
      refreshUser();
    });
  } catch {
    // ignore
  }
}

document.addEventListener('DOMContentLoaded', () => {
  init();
});
