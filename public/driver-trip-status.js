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

function init() {
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
