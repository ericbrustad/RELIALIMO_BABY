const STORAGE_KEY = 'relia_farmout_assignments';
const REFRESH_KEY = 'relia_trip_status_update';
const REFRESH_INTERVAL_MS = 20000;

const FARMOUT_STATUS_ALIASES = {
  '': '',
  farm_out_unassigned: 'unassigned',
  farmout_unassigned: 'unassigned',
  created_farm_out_unassigned: 'unassigned',
  created_farmout_unassigned: 'unassigned',
  farm_out_assigned: 'assigned',
  farmout_assigned: 'assigned',
  created_farm_out_assigned: 'assigned',
  created_farmout_assigned: 'assigned',
  farm_out_offered: 'offered',
  farmout_offered: 'offered',
  farm_out_declined: 'declined',
  farmout_declined: 'declined',
  farm_out_completed: 'completed',
  farmout_completed: 'completed',
  done: 'completed',
  en_route: 'enroute',
  enroute: 'enroute',
  passenger_on_board: 'passenger_onboard',
  passenger_on_boarded: 'passenger_onboard',
  passenger_on_boarding: 'passenger_onboard',
  inhouse: 'in_house',
  'in-house': 'in_house',
  in_house_dispatch: 'in_house'
};

function normalizeFarmoutKey(value) {
  return value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/__+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function canonicalizeFarmoutStatus(status) {
  if (!status) {
    return '';
  }
  const normalized = normalizeFarmoutKey(status);
  const alias = FARMOUT_STATUS_ALIASES[normalized];
  return alias || normalized;
}

const statusMeta = {
  assigned: { label: 'Assigned', emoji: '🗂️' },
  enroute: { label: 'En Route', emoji: '🚕' },
  arrived: { label: 'Arrived', emoji: '📍' },
  passenger_onboard: { label: 'Passenger On Board', emoji: '🧑\u200d🤝\u200d🧑' },
  completed: { label: 'Completed', emoji: '✅' },
  in_house: { label: 'In House', emoji: '🏢' },
  offered: { label: 'Offered', emoji: '📨' },
  declined: { label: 'Declined', emoji: '⛔' },
  unassigned: { label: 'Unassigned', emoji: '⚪' },
  offered_to_affiliate: { label: 'Offered to Affiliate', emoji: '🌐' },
  affiliate_assigned: { label: 'Affiliate Assigned', emoji: '🤝' },
  affiliate_driver_assigned: { label: 'Affiliate Driver Assigned', emoji: '🚘' },
  driver_en_route: { label: 'Driver En Route', emoji: '🚗' },
  on_the_way: { label: 'Driver On The Way', emoji: '🚗' },
  driver_waiting_at_pickup: { label: 'Waiting at Pickup', emoji: '⏱️' },
  waiting_at_pickup: { label: 'Waiting at Pickup', emoji: '⏱️' },
  driver_circling: { label: 'Driver Circling', emoji: '⭕' },
  customer_in_car: { label: 'Customer In Car', emoji: '🚘' },
  driving_passenger: { label: 'Driving Passenger', emoji: '🛣️' },
  cancelled: { label: 'Cancelled', emoji: '🛑' },
  cancelled_by_affiliate: { label: 'Cancelled by Affiliate', emoji: '🛑' },
  late_cancel: { label: 'Late Cancel', emoji: '⚠️' },
  late_cancelled: { label: 'Late Cancelled', emoji: '⚠️' },
  no_show: { label: 'No Show', emoji: '🚫' },
  covid19_cancellation: { label: 'COVID-19 Cancellation', emoji: '🦠' }
};

const statusSortOrder = [
  'unassigned',
  'offered',
  'offered_to_affiliate',
  'affiliate_assigned',
  'affiliate_driver_assigned',
  'assigned',
  'enroute',
  'driver_en_route',
  'on_the_way',
  'arrived',
  'driver_waiting_at_pickup',
  'waiting_at_pickup',
  'passenger_onboard',
  'driver_circling',
  'customer_in_car',
  'driving_passenger',
  'declined',
  'cancelled',
  'cancelled_by_affiliate',
  'late_cancel',
  'late_cancelled',
  'no_show',
  'covid19_cancellation',
  'completed',
  'in_house'
];

const modeLabels = {
  manual: 'Manual Dispatch',
  automatic: 'Auto-Dispatch'
};

const elements = {
  list: document.getElementById('assignmentList'),
  lastSync: document.getElementById('lastSync'),
  refreshBtn: document.getElementById('refreshBtn'),
  toast: document.getElementById('toast')
};

function showToast(message) {
  if (!elements.toast) return;
  elements.toast.textContent = message;
  elements.toast.classList.remove('hidden');
  requestAnimationFrame(() => {
    elements.toast.classList.add('visible');
  });
  setTimeout(() => {
    elements.toast.classList.remove('visible');
    setTimeout(() => elements.toast.classList.add('hidden'), 250);
  }, 2600);
}

function readAssignments() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data;
  } catch (error) {
    console.warn('Unable to parse farm-out assignments:', error);
    return [];
  }
}

function resolveStatusMeta(status) {
  const canonical = canonicalizeFarmoutStatus(status) || 'unassigned';
  return statusMeta[canonical] || { label: normalizeLabel(canonical || 'unknown'), emoji: '❔' };
}

function normalizeLabel(value) {
  return value
    .split('_')
    .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function normalizePhone(phone) {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

function parsePickupDateTime(assignment) {
  if (!assignment) return null;
  const date = assignment.pickupDate;
  const timeRaw = assignment.pickupTime;
  if (!date || !timeRaw) return null;

  const trimmedTime = timeRaw.trim();
  const time = trimmedTime.length === 5 ? trimmedTime : trimmedTime.padStart(5, '0');

  let parsed = new Date(`${date}T${time}`);
  if (Number.isNaN(parsed.getTime())) {
    parsed = new Date(`${date} ${trimmedTime}`);
  }

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function renderAssignments(assignments) {
  if (!elements.list) return;

  if (!assignments.length) {
    elements.list.innerHTML = '<div class="empty-state">No active farm-out trips. Dispatch assignments will appear here once a driver is assigned.</div>';
    return;
  }

  const sorted = [...assignments].sort((a, b) => {
    const aStatus = canonicalizeFarmoutStatus(a.farmoutStatus || '') || 'unassigned';
    const bStatus = canonicalizeFarmoutStatus(b.farmoutStatus || '') || 'unassigned';
    const statusRank = status => {
      const idx = statusSortOrder.indexOf(status);
      return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
    };

    const rankDiff = statusRank(aStatus) - statusRank(bStatus);
    if (rankDiff !== 0) return rankDiff;

    const aTime = parsePickupDateTime(a);
    const bTime = parsePickupDateTime(b);
    if (aTime && bTime) return aTime - bTime;
    if (aTime) return -1;
    if (bTime) return 1;

    return (a.confirmationNumber || '').localeCompare(b.confirmationNumber || '');
  });

  elements.list.innerHTML = sorted
    .map(assignment => {
      const canonicalStatus = canonicalizeFarmoutStatus(assignment.farmoutStatus || '') || 'unassigned';
      const statusInfo = resolveStatusMeta(canonicalStatus);
      const driver = assignment.driver || {};
      const modeCanonical = normalizeFarmoutKey(assignment.farmoutMode || 'manual') || 'manual';
      const modeLabel = modeLabels[modeCanonical] || normalizeLabel(modeCanonical);
      const tripLink = assignment.tripLink;
      const updatedAt = assignment.updatedAt ? new Date(assignment.updatedAt) : null;
      const contactParts = [];
      if (driver.affiliate) contactParts.push(driver.affiliate);
      if (driver.phone) contactParts.push(normalizePhone(driver.phone));
      const contactText = contactParts.length ? contactParts.join(' • ') : '—';

      return `
        <article class="assignment-card">
          <header class="assignment-header">
            <h2>${driver.name || 'Pending Driver'}</h2>
            <span class="status-pill status-${canonicalStatus}">${statusInfo.emoji} ${statusInfo.label}</span>
          </header>
          <div class="detail-row">
            <span class="detail-label">Passenger</span>
            <span>${assignment.passengerName || '—'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Pickup</span>
            <span>${assignment.pickupDate || '—'} • ${assignment.pickupTime || '—'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Driver Contact</span>
            <span>${contactText}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Vehicle</span>
            <span>${driver.vehicleType || '—'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Confirmation</span>
            <span>#${assignment.confirmationNumber || assignment.reservationId || '—'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Dispatch Mode</span>
            <span>${modeLabel}</span>
          </div>
          ${tripLink ? `<div class="detail-row"><span class="detail-label">Trip Link</span><a href="${tripLink}" target="_blank" rel="noopener" class="link">Open live view</a></div>` : ''}
          ${updatedAt ? `<div class="detail-row"><span class="detail-label">Last Update</span><span>${updatedAt.toLocaleString()}</span></div>` : ''}
        </article>
      `;
    })
    .join('');
}

function updateLastSync(assignments) {
  if (!elements.lastSync) return;
  const latest = assignments
    .map(item => item.updatedAt ? new Date(item.updatedAt) : null)
    .filter(Boolean)
    .sort((a, b) => b - a)[0];
  const stamp = latest ? latest.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  elements.lastSync.textContent = `Last sync: ${stamp}`;
}

function refreshAssignments({ silent = false } = {}) {
  const assignments = readAssignments();
  renderAssignments(assignments);
  updateLastSync(assignments);
  if (!silent) {
    showToast(assignments.length ? `Loaded ${assignments.length} active trip${assignments.length === 1 ? '' : 's'}.` : 'No active farm-out trips found.');
  }
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
      if (status.state === 'denied') {
        showPermissionWarning('location');
        return { supported: true, granted: false, denied: true };
      }
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
  if (Notification.permission === 'denied') {
    showPermissionWarning('notification');
    return { supported: true, granted: false, denied: true };
  }
  try {
    const perm = await Notification.requestPermission();
    if (perm === 'denied') showPermissionWarning('notification');
    return { supported: true, granted: perm === 'granted', denied: perm === 'denied' };
  } catch (err) {
    return { supported: true, granted: false, error: err.message };
  }
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

function init() {
  // Check permissions first
  ensureRequiredPermissions();
  
  refreshAssignments({ silent: true });

  if (elements.refreshBtn) {
    elements.refreshBtn.addEventListener('click', () => refreshAssignments());
  }

  window.addEventListener('storage', event => {
    if (!event) return;
    if (event.key === STORAGE_KEY || event.key === REFRESH_KEY) {
      refreshAssignments({ silent: true });
    }
  });

  setInterval(() => refreshAssignments({ silent: true }), REFRESH_INTERVAL_MS);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
