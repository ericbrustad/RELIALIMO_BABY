const STATUS_FLOW = [
  { value: 'enroute', label: 'En Route', description: 'Heading to the pickup location.' },
  { value: 'arrived', label: 'Arrived', description: 'On location and waiting for the passenger.' },
  { value: 'passenger_onboard', label: 'Passenger Onboard', description: 'Passenger loaded and trip is under way.' },
  { value: 'completed', label: 'Completed', description: 'Drop-off finished and paperwork ready.' }
];

const pageTitle = document.getElementById('pageTitle');
const pageSubtitle = document.getElementById('pageSubtitle');
const statusList = document.getElementById('statusList');
const notesField = document.getElementById('driverNotes');
const supportBtn = document.getElementById('supportBtn');
const lastUpdateEl = document.getElementById('lastUpdate');
const toastEl = document.getElementById('toast');

const params = new URLSearchParams(window.location.search);
const reservationId = params.get('reservation');
const driverId = params.get('driver') || 'driver';
const historyKey = `${reservationId || 'unknown'}::${driverId}`;

let currentStatus = 'enroute';
let currentNotes = '';
let currentTimestamp = null;
let notesTimer = null;

function loadHistory() {
  try {
    const raw = localStorage.getItem('relia_trip_status_history');
    if (!raw) return;
    const parsed = JSON.parse(raw);
    const entry = parsed?.[historyKey];
    if (entry) {
      currentStatus = entry.status || currentStatus;
      currentNotes = entry.notes || '';
      currentTimestamp = entry.updatedAt || null;
    }
  } catch (error) {
    console.warn('Unable to parse trip history:', error);
  }
}

function saveHistory() {
  try {
    const raw = localStorage.getItem('relia_trip_status_history');
    const store = raw ? JSON.parse(raw) : {};
    store[historyKey] = {
      status: currentStatus,
      notes: currentNotes,
      updatedAt: currentTimestamp
    };
    localStorage.setItem('relia_trip_status_history', JSON.stringify(store));
  } catch (error) {
    console.warn('Unable to persist trip history:', error);
  }
}

function renderStatuses() {
  if (!statusList) return;

  const currentIndex = STATUS_FLOW.findIndex(item => item.value === currentStatus);
  const cards = STATUS_FLOW.map((status, index) => {
    const isCurrent = status.value === currentStatus;
    const isCompleted = index < currentIndex;
    const classes = ['status-card'];
    if (isCurrent) classes.push('active');
    if (isCompleted) classes.push('completed');

    const buttonDisabled = isCurrent ? 'disabled' : '';
    const buttonText = isCurrent ? 'Current status' : `Mark ${status.label}`;
    const buttonClass = isCurrent ? 'btn btn-secondary' : 'btn btn-primary';

    return `
      <article class="${classes.join(' ')}" data-status="${status.value}">
        <div class="status-info">
          <span class="status-label">${status.label}</span>
          <span class="status-description">${status.description}</span>
          ${isCurrent && currentTimestamp ? `<span class="status-meta">Updated ${new Date(currentTimestamp).toLocaleTimeString()}</span>` : ''}
        </div>
        <div class="status-action">
          <button class="${buttonClass}" data-status="${status.value}" ${buttonDisabled}>${buttonText}</button>
        </div>
      </article>
    `;
  }).join('');

  statusList.innerHTML = cards;
  bindStatusButtons();
}

function bindStatusButtons() {
  document.querySelectorAll('[data-status][class*="btn"]').forEach(button => {
    button.addEventListener('click', () => {
      const status = button.dataset.status;
      setStatus(status);
    });
  });
}

function setStatus(status) {
  currentStatus = status;
  currentTimestamp = new Date().toISOString();
  emitTripStatusUpdate();
  saveHistory();
  renderStatuses();
  updateLastUpdate();
  showToast(`${STATUS_FLOW.find(item => item.value === status)?.label || 'Status'} sent to dispatch.`);
}

function emitTripStatusUpdate() {
  if (!reservationId) return;
  const payload = {
    reservationId,
    driverId,
    status: currentStatus,
    updatedAt: currentTimestamp
  };

  try {
    localStorage.setItem('relia_trip_status_update', JSON.stringify(payload));
  } catch (error) {
    console.warn('Unable to publish trip status update:', error);
  }
}

function updateLastUpdate() {
  if (!lastUpdateEl) return;
  if (!currentTimestamp) {
    lastUpdateEl.textContent = 'Last update: Never';
    return;
  }
  lastUpdateEl.textContent = `Last update: ${new Date(currentTimestamp).toLocaleString()}`;
}

function showToast(message) {
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.classList.add('visible');
  toastEl.classList.remove('hidden');
  setTimeout(() => {
    toastEl.classList.remove('visible');
    toastEl.classList.add('hidden');
  }, 2000);
}

function scheduleNotesSave() {
  clearTimeout(notesTimer);
  notesTimer = setTimeout(() => {
    currentNotes = notesField.value;
    currentTimestamp = new Date().toISOString();
    saveHistory();
    emitTripStatusUpdate();
    updateLastUpdate();
  }, 400);
}

function hydratePageHeader() {
  if (reservationId && pageTitle) {
    pageTitle.textContent = `Trip #${reservationId}`;
  }
  if (driverId && pageSubtitle) {
    pageSubtitle.textContent = `Driver ID: ${driverId}. Tap the milestone you just completed.`;
  }
}

function bootstrapSupportButton() {
  if (!supportBtn) return;
  supportBtn.addEventListener('click', () => {
    window.location.href = 'tel:+19525551234';
  });
}

function handleStorageEvent(event) {
  if (event.key !== 'relia_trip_status_update') return;
  try {
    const payload = JSON.parse(event.newValue || '{}');
    if (!payload || payload.reservationId !== reservationId) return;
    if (payload.status) {
      currentStatus = payload.status;
      currentTimestamp = payload.updatedAt || new Date().toISOString();
      saveHistory();
      renderStatuses();
      updateLastUpdate();
      showToast('Dispatch updated the trip status.');
    }
  } catch (error) {
    console.warn('Unable to apply remote trip status update:', error);
  }
}

// ============================================
// Location & Notification Permission Management
// ============================================
async function checkAndRequestLocationPermission() {
  console.log('[TripStatus] Checking location permission...');
  
  if (!('geolocation' in navigator)) {
    console.warn('[TripStatus] Geolocation not supported by this browser');
    return { supported: false, granted: false };
  }
  
  if ('permissions' in navigator) {
    try {
      const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
      if (permissionStatus.state === 'granted') {
        console.log('[TripStatus] ✅ Location permission already granted');
        return { supported: true, granted: true };
      } else if (permissionStatus.state === 'denied') {
        console.warn('[TripStatus] ❌ Location permission denied');
        showPermissionWarning('location');
        return { supported: true, granted: false, denied: true };
      }
    } catch (err) {
      console.warn('[TripStatus] Could not query location permission:', err);
    }
  }
  
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      () => {
        console.log('[TripStatus] ✅ Location permission granted');
        resolve({ supported: true, granted: true });
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          showPermissionWarning('location');
          resolve({ supported: true, granted: false, denied: true });
        } else {
          resolve({ supported: true, granted: false, error: error.message });
        }
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  });
}

async function checkAndRequestNotificationPermission() {
  console.log('[TripStatus] Checking notification permission...');
  
  if (!('Notification' in window)) {
    return { supported: false, granted: false };
  }
  
  if (Notification.permission === 'granted') {
    return { supported: true, granted: true };
  }
  
  if (Notification.permission === 'denied') {
    showPermissionWarning('notification');
    return { supported: true, granted: false, denied: true };
  }
  
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      return { supported: true, granted: true };
    } else if (permission === 'denied') {
      showPermissionWarning('notification');
    }
    return { supported: true, granted: false, denied: permission === 'denied' };
  } catch (err) {
    return { supported: true, granted: false, error: err.message };
  }
}

function showPermissionWarning(type) {
  const bannerId = `${type}-permission-banner`;
  if (document.getElementById(bannerId)) return;
  
  const banner = document.createElement('div');
  banner.id = bannerId;
  banner.style.cssText = `
    position: fixed;
    top: ${type === 'notification' && document.getElementById('location-permission-banner') ? '45px' : '0'};
    left: 0; right: 0;
    background: ${type === 'location' ? '#ff6b35' : '#f59e0b'};
    color: white;
    padding: 10px 15px;
    z-index: ${type === 'location' ? 10000 : 9999};
    font-size: 14px;
    text-align: center;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
  `;
  banner.innerHTML = `
    ${type === 'location' ? '📍 Location services disabled.' : '🔔 Notifications disabled.'} 
    Enable in browser settings.
    <button onclick="this.parentElement.remove()" style="margin-left:10px;background:none;border:none;color:white;font-size:16px;cursor:pointer;">✕</button>
  `;
  document.body.prepend(banner);
}

async function ensureRequiredPermissions() {
  console.log('[TripStatus] Checking required permissions...');
  await Promise.all([
    checkAndRequestLocationPermission(),
    checkAndRequestNotificationPermission()
  ]);
}

function init() {
  // Check permissions first
  ensureRequiredPermissions();
  
  if (!reservationId) {
    statusList.innerHTML = '<p class="status-description">Reservation ID missing. Use the dispatcher link to access this page.</p>';
    return;
  }

  hydratePageHeader();
  loadHistory();
  renderStatuses();
  updateLastUpdate();
  bootstrapSupportButton();

  if (notesField) {
    notesField.value = currentNotes;
    notesField.addEventListener('input', scheduleNotesSave);
  }

  window.addEventListener('storage', handleStorageEvent);
}

document.addEventListener('DOMContentLoaded', init);
