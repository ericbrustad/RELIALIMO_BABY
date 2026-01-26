function getDrivers() {
  try {
    const raw = localStorage.getItem('relia_driver_directory');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) {
        return parsed.map((d, idx) => {
          const first = d.first_name || d.first || '';
          const last = d.last_name || d.last || '';
          const name = [first, last].filter(Boolean).join(' ').trim() || d.name || `Driver ${idx + 1}`;
          const status = (d.driver_status || d.status || 'available').toString().toLowerCase();
          return {
            id: d.id || idx + 1,
            name,
            vehicle: d.vehicle || d.vehicle_type || d.car_type || 'Not Assigned',
            affiliate: d.affiliate || d.affiliate_name || d.company || 'Fleet',
            phone: d.cell_phone || d.mobile_phone || d.phone || d.phone_number || d.primary_phone || '',
            driver_status: status,
            driver_level: d.driver_level || d.level || null
          };
        });
      }
    }
  } catch (error) {
    console.warn('Unable to read driver directory:', error);
  }

  // No cached drivers - return empty array
  // Real drivers should be loaded from Supabase via the driver directory
  console.warn('[driver-active-list] No driver directory found. Load drivers from My Office → Drivers.');
  return [];
}

const STATUS_LABELS = {
  available: 'Available',
  offline: 'Offline'
};

const availableList = document.getElementById('availableList');
const offlineList = document.getElementById('offlineList');
const availableCount = document.getElementById('availableCount');
const offlineCount = document.getElementById('offlineCount');
const lastSync = document.getElementById('lastSync');
const refreshBtn = document.getElementById('refreshBtn');
const toastEl = document.getElementById('toast');

let overrides = [];
let toastTimer = null;

function escapeHtml(value = '') {
  return value
    .toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function loadOverrides() {
  try {
    const raw = localStorage.getItem('relia_driver_status_overrides');
    overrides = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(overrides)) {
      overrides = [];
    }
  } catch (error) {
    console.warn('Unable to parse driver overrides:', error);
    overrides = [];
  }
}

function getDriverState(driver) {
  const override = overrides.find(item => Number(item?.id) === Number(driver.id));
  const baseStatus = (driver.driver_status || 'available').toLowerCase();
  const normalizedBase = STATUS_LABELS[baseStatus] ? baseStatus : 'available';
  const normalizedOverride = override?.status || normalizedBase;
  return {
    status: STATUS_LABELS[normalizedOverride] ? normalizedOverride : normalizedBase,
    notes: override?.notes || ''
  };
}

function renderLists() {
  const availableDrivers = [];
  const offlineDrivers = [];

  const drivers = getDrivers();

  drivers.forEach(driver => {
    const state = getDriverState(driver);
    if (state.status === 'available') {
      availableDrivers.push({ driver, state });
    } else if (state.status === 'offline') {
      offlineDrivers.push({ driver, state });
    }
  });

  const renderCard = ({ driver, state }) => `
    <article class="driver-card">
      <span class="name">${escapeHtml(driver.name)}</span>
      <span class="meta">${escapeHtml(driver.vehicle)} • ${escapeHtml(driver.affiliate)}${driver.driver_level ? ' • Lvl ' + driver.driver_level : ''}</span>
      <span class="meta">${escapeHtml(driver.phone)}</span>
      <span class="status ${escapeHtml(state.status)}">${STATUS_LABELS[state.status] || 'Status Unknown'}</span>
      ${state.notes ? `<div class="notes">${escapeHtml(state.notes)}</div>` : ''}
    </article>
  `;

  availableList.innerHTML = availableDrivers.length
    ? availableDrivers.map(renderCard).join('')
    : '<p class="meta">No drivers are currently marked available.</p>';

  offlineList.innerHTML = offlineDrivers.length
    ? offlineDrivers.map(renderCard).join('')
    : '<p class="meta">No drivers are marked offline.</p>';

  availableCount.textContent = availableDrivers.length;
  offlineCount.textContent = offlineDrivers.length;
}

function updateLastSync() {
  if (!lastSync) return;
  const timestamps = overrides
    .map(item => item?.updatedAt)
    .filter(Boolean)
    .map(value => Date.parse(value))
    .filter(value => !Number.isNaN(value));

  if (!timestamps.length) {
    lastSync.textContent = 'Last sync: Never';
    return;
  }

  const latest = new Date(Math.max(...timestamps));
  lastSync.textContent = `Last sync: ${latest.toLocaleString()}`;
}

function showToast(message) {
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.classList.add('visible');
  toastEl.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.classList.remove('visible');
    toastEl.classList.add('hidden');
  }, 2000);
}

function refresh() {
  loadOverrides();
  renderLists();
  updateLastSync();
  showToast('Driver list refreshed.');
}

function init() {
  loadOverrides();
  renderLists();
  updateLastSync();

  if (refreshBtn) {
    refreshBtn.addEventListener('click', refresh);
  }

  window.addEventListener('storage', (event) => {
    if (event.key === 'relia_driver_status_overrides' || event.key === 'relia_driver_status_overrides_timestamp') {
      loadOverrides();
      renderLists();
      updateLastSync();
      showToast('Driver availability updated.');
    }
  });
}

// ============================================
// Location & Notification Permission Management
// ============================================
async function checkAndRequestLocationPermission() {
  if (!('geolocation' in navigator)) return { supported: false, granted: false };
  if ('permissions' in navigator) {
    try {
      const status = await navigator.permissions.query({ name: 'geolocation' });
      if (status.state === 'granted') return { supported: true, granted: true };
      if (status.state === 'denied') { showPermissionWarning('location'); return { supported: true, granted: false, denied: true }; }
    } catch (err) { /* continue */ }
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      () => resolve({ supported: true, granted: true }),
      (error) => {
        if (error.code === error.PERMISSION_DENIED) showPermissionWarning('location');
        resolve({ supported: true, granted: false, denied: error.code === error.PERMISSION_DENIED });
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  });
}

async function checkAndRequestNotificationPermission() {
  if (!('Notification' in window)) return { supported: false, granted: false };
  if (Notification.permission === 'granted') return { supported: true, granted: true };
  if (Notification.permission === 'denied') { showPermissionWarning('notification'); return { supported: true, granted: false, denied: true }; }
  try {
    const perm = await Notification.requestPermission();
    if (perm === 'denied') showPermissionWarning('notification');
    return { supported: true, granted: perm === 'granted', denied: perm === 'denied' };
  } catch (err) { return { supported: true, granted: false, error: err.message }; }
}

function showPermissionWarning(type) {
  const bannerId = `${type}-permission-banner`;
  if (document.getElementById(bannerId)) return;
  const banner = document.createElement('div');
  banner.id = bannerId;
  banner.style.cssText = `position:fixed;top:${type === 'notification' && document.getElementById('location-permission-banner') ? '45px' : '0'};left:0;right:0;background:${type === 'location' ? '#ff6b35' : '#f59e0b'};color:white;padding:10px 15px;z-index:${type === 'location' ? 10000 : 9999};font-size:14px;text-align:center;`;
  banner.innerHTML = `${type === 'location' ? '📍 Location services disabled.' : '🔔 Notifications disabled.'} Enable in browser settings. <button onclick="this.parentElement.remove()" style="margin-left:10px;background:none;border:none;color:white;font-size:16px;cursor:pointer;">✕</button>`;
  document.body.prepend(banner);
}

async function ensureRequiredPermissions() {
  await Promise.all([checkAndRequestLocationPermission(), checkAndRequestNotificationPermission()]);
}

document.addEventListener('DOMContentLoaded', () => {
  ensureRequiredPermissions();
  init();
});
