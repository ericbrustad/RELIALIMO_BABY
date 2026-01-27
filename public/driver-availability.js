import { supabase, getSupabaseClient } from './config.js';

const STATUS_OPTIONS = [
	{ value: 'available', label: 'Available', hint: 'Ready for new trips' },
	{ value: 'enroute', label: 'En Route', hint: 'Heading to the pickup location' },
	{ value: 'arrived', label: 'Arrived', hint: 'Waiting at pickup location' },
	{ value: 'passenger_onboard', label: 'Passenger On Board', hint: 'Passenger loaded, en route to drop-off' },
	{ value: 'busy', label: 'Busy', hint: 'Unavailable or on another job' },
	{ value: 'offline', label: 'Offline', hint: 'Off shift / not taking trips' }
];

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
						vehicle: d.vehicle_type || d.vehicle || d.car_type || 'Vehicle',
						affiliate: d.affiliate || d.affiliate_name || d.company || 'Fleet',
						phone: d.cell_phone || d.mobile_phone || d.phone || d.phone_number || d.primary_phone || '',
						driver_status: STATUS_OPTIONS.some(s => s.value === status) ? status : 'available',
						driver_level: d.driver_level || d.level || null
					};
				});
			}
		}
	} catch (e) {
		console.warn('Unable to read driver directory:', e.message);
	}

	// No cached drivers - return empty array
	// Real drivers should be loaded from Supabase via the driver directory
	console.warn('[driver-availability] No driver directory found. Load drivers from My Office → Drivers.');
	return [];
}

let overrides = [];

function normalizeId(value) {
	return value === undefined || value === null ? '' : String(value);
}

const driverGrid = document.getElementById('driverGrid');
const offlineSidebar = document.getElementById('offlineSidebar');
const lastSyncEl = document.getElementById('lastSync');
const resetBtn = document.getElementById('resetOverrides');
const refreshBtn = document.getElementById('refreshView');
const toastEl = document.getElementById('toast');
let isListeningForStorage = false;

function escapeHtml(value) {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function loadOverrides() {
	try {
		const raw = localStorage.getItem('relia_driver_status_overrides');
		if (!raw) {
			overrides = [];
			return;
		}
		const parsed = JSON.parse(raw);
		overrides = Array.isArray(parsed) ? parsed : [];
	} catch (error) {
		console.warn('Unable to parse driver overrides:', error);
		overrides = [];
	}
}

function findOverride(driverId) {
	const targetId = normalizeId(driverId);
	return overrides.find(item => item && normalizeId(item.id) === targetId);
}

function ensureOverride(driverId) {
	let override = findOverride(driverId);
	if (!override) {
		const baseDriver = getDrivers().find(d => normalizeId(d.id) === normalizeId(driverId));
		override = { id: normalizeId(driverId), status: baseDriver?.driver_status || 'available', notes: '' };
		overrides.push(override);
	}
	return override;
}

function getDriverState(driver) {
	const override = findOverride(driver.id);
	const baseStatus = (driver.driver_status || 'available').toLowerCase();
	return {
		status: override?.status || baseStatus || 'available',
		notes: override?.notes || ''
	};
}

function renderDrivers() {
	if (!driverGrid) return;

	const drivers = getDrivers();

	if (!drivers.length) {
		driverGrid.innerHTML = '<div class="empty">No drivers found. Add drivers in My Office and refresh.</div>';
		if (offlineSidebar) offlineSidebar.innerHTML = '';
		return;
	}

	const online = [];
	const offline = [];

	drivers.forEach(driver => {
		const state = getDriverState(driver);
		const statusInfo = STATUS_OPTIONS.find(option => option.value === state.status) || STATUS_OPTIONS[0];
		const statusOptionsMarkup = STATUS_OPTIONS.map(option => {
			const selected = option.value === state.status ? 'selected' : '';
			return `<option value="${option.value}" ${selected}>${option.label}</option>`;
		}).join('');

		const cardHtml = `
			<article class="driver-card ${state.status === 'offline' ? 'offline' : ''}" data-driver-id="${driver.id}">
				<div class="driver-header">
					<span class="driver-name">${escapeHtml(driver.name)}</span>
					<span class="driver-meta">${escapeHtml(driver.vehicle)} • ${escapeHtml(driver.affiliate)}${driver.driver_level ? ' • Lvl ' + driver.driver_level : ''}</span>
					<span class="driver-meta">${escapeHtml(driver.phone)}</span>
					<span class="status-pill ${statusInfo.value}">${statusInfo.label}</span>
					<span class="status-hint">${statusInfo.hint}</span>
				</div>
				<div class="driver-control">
					<label for="status-${driver.id}" class="driver-meta">Current status</label>
					<select id="status-${driver.id}" class="status-select" data-driver-id="${driver.id}">
						${statusOptionsMarkup}
					</select>
				</div>
				<div class="driver-control">
					<label for="notes-${driver.id}" class="driver-meta">Notes to dispatch</label>
					<textarea id="notes-${driver.id}" class="notes-input" data-driver-id="${driver.id}" placeholder="Availability details, time back, etc.">${escapeHtml(state.notes)}</textarea>
				</div>
			</article>
		`;

		if (state.status === 'offline') {
			offline.push({ driver, cardHtml });
		} else {
			online.push(cardHtml);
		}
	});

	driverGrid.innerHTML = online.join('');

	if (offlineSidebar) {
		if (!offline.length) {
			offlineSidebar.innerHTML = '';
		} else {
			offlineSidebar.innerHTML = `
				<div>
					<h3>Offline (${offline.length})</h3>
					<div class="offline-list">
						${offline.map(({ driver }) => `
							<div class="offline-item">
								<div class="name">${escapeHtml(driver.name)}</div>
								<div class="meta">${escapeHtml(driver.vehicle || '')}</div>
							</div>
						`).join('')}
					</div>
				</div>
			`;
		}
	}
}

async function updateOverride(driverId, changes) {
	if (!driverId) return;

	if (changes?.status && !STATUS_OPTIONS.some(option => option.value === changes.status)) {
		return;
	}

	const override = ensureOverride(driverId);
	if (changes) Object.assign(override, changes);
	override.updatedAt = new Date().toISOString();
	saveOverrides();
	
	// Also update local driver directory cache
	if (changes?.status) {
		updateLocalDriverDirectory(driverId, changes.status);
	}
	
	renderDrivers();
	showToast('Updating...');
	
	// Sync to Supabase
	if (changes?.status) {
		const success = await syncStatusToSupabase(driverId, changes.status);
		if (success) {
			showToast('Status saved to database ✓');
		} else {
			showToast('Saved locally (sync pending)');
		}
	} else {
		showToast('Notes updated.');
	}
}

// Update the local relia_driver_directory cache
function updateLocalDriverDirectory(driverId, newStatus) {
	try {
		const raw = localStorage.getItem('relia_driver_directory');
		if (!raw) return;
		
		const drivers = JSON.parse(raw);
		if (!Array.isArray(drivers)) return;
		
		const normalizedId = String(driverId);
		const updated = drivers.map(d => {
			if (String(d.id) === normalizedId) {
				return {
					...d,
					driver_status: newStatus,
					status: newStatus.toUpperCase()
				};
			}
			return d;
		});
		
		localStorage.setItem('relia_driver_directory', JSON.stringify(updated));
		console.log('[driver-availability] Updated local driver directory for', driverId, 'to', newStatus);
	} catch (e) {
		console.warn('[driver-availability] Could not update local driver directory:', e);
	}
}

// Sync status change to Supabase drivers table
async function syncStatusToSupabase(driverId, newStatus) {
	try {
		const client = getSupabaseClient ? getSupabaseClient() : supabase;
		if (!client) {
			console.warn('[driver-availability] No Supabase client available');
			return false;
		}
		
		// Map availability status to driver_status field in Supabase
		// The drivers table has 'driver_status' column
		const { error } = await client
			.from('drivers')
			.update({ 
				driver_status: newStatus,
				updated_at: new Date().toISOString()
			})
			.eq('id', driverId);
		
		if (error) {
			console.error('[driver-availability] Supabase update failed:', error);
			return false;
		}
		
		console.log('[driver-availability] Synced driver', driverId, 'status to Supabase:', newStatus);
		return true;
	} catch (e) {
		console.error('[driver-availability] Error syncing to Supabase:', e);
		return false;
	}
}

function updateNotes(driverId, notes) {
	if (!driverId) return;
	const override = ensureOverride(driverId);
	override.notes = notes || '';
	override.updatedAt = new Date().toISOString();
	saveOverrides();
}

function saveOverrides() {
	try {
		localStorage.setItem('relia_driver_status_overrides', JSON.stringify(overrides));
		localStorage.setItem('relia_driver_status_overrides_timestamp', Date.now().toString());
		updateLastSync();
	} catch (error) {
		console.warn('Unable to persist overrides:', error);
	}
}

function resetOverrides() {
	overrides = [];
	saveOverrides();
	renderDrivers();
	showToast('All statuses reset.');
}

function refreshFromStorage() {
	loadOverrides();
	renderDrivers();
	showToast('Availability refreshed.');
}

function updateLastSync() {
	if (!lastSyncEl) return;
	const timestamps = overrides
		.map(item => item?.updatedAt)
		.filter(Boolean)
		.map(value => Date.parse(value))
		.filter(value => !Number.isNaN(value));

	if (!timestamps.length) {
		const raw = localStorage.getItem('relia_driver_status_overrides_timestamp');
		const fallback = raw ? Number(raw) : 0;
		if (!fallback || Number.isNaN(fallback)) {
			lastSyncEl.textContent = 'Last sync: Never';
			return;
		}
		lastSyncEl.textContent = `Last sync: ${new Date(fallback).toLocaleString()}`;
		return;
	}

	const latest = new Date(Math.max(...timestamps));
	lastSyncEl.textContent = `Last sync: ${latest.toLocaleString()}`;
}

let toastTimer = null;
function showToast(message) {
	if (!toastEl) return;
	if (toastTimer) clearTimeout(toastTimer);
	toastEl.textContent = message;
	toastEl.classList.add('visible');
	toastEl.classList.remove('hidden');
	toastTimer = setTimeout(() => {
		toastEl.classList.remove('visible');
		toastEl.classList.add('hidden');
	}, 2000);
}

function attachEvents() {
	if (driverGrid) {
		driverGrid.addEventListener('change', (event) => {
			if (event.target && event.target.classList.contains('status-select')) {
				const driverId = Number(event.target.getAttribute('data-driver-id'));
				const newStatus = event.target.value;
				updateOverride(driverId, { status: newStatus });
			}
		});

		driverGrid.addEventListener('input', (event) => {
			if (event.target && event.target.classList.contains('notes-input')) {
				const driverId = Number(event.target.getAttribute('data-driver-id'));
				const newNotes = event.target.value;
				updateNotes(driverId, newNotes);
			}
		});
	}

	if (resetBtn) {
		resetBtn.addEventListener('click', () => resetOverrides());
	}

	if (refreshBtn) {
		refreshBtn.addEventListener('click', () => refreshFromStorage());
	}

	if (!isListeningForStorage) {
		window.addEventListener('storage', (event) => {
			if (!event || !event.key) return;
			if (
				event.key === 'relia_driver_status_overrides' ||
				event.key === 'relia_driver_status_overrides_timestamp' ||
				event.key === 'relia_driver_directory'
			) {
				loadOverrides();
				renderDrivers();
				updateLastSync();
			}
		});
		isListeningForStorage = true;
	}
}

// Load drivers fresh from Supabase and update local cache
async function refreshDriversFromSupabase() {
	try {
		const client = getSupabaseClient ? getSupabaseClient() : supabase;
		if (!client) {
			console.warn('[driver-availability] No Supabase client for refresh');
			return false;
		}
		
		const { data, error } = await client
			.from('drivers')
			.select('*')
			.order('last_name', { ascending: true });
		
		if (error) {
			console.error('[driver-availability] Failed to load drivers from Supabase:', error);
			return false;
		}
		
		if (data && data.length > 0) {
			localStorage.setItem('relia_driver_directory', JSON.stringify(data));
			console.log('[driver-availability] Refreshed', data.length, 'drivers from Supabase');
			return true;
		}
		
		return false;
	} catch (e) {
		console.error('[driver-availability] Error refreshing from Supabase:', e);
		return false;
	}
}

async function init() {
	loadOverrides();
	renderDrivers();
	updateLastSync();
	attachEvents();
	
	// Try to refresh drivers from Supabase in background
	const refreshed = await refreshDriversFromSupabase();
	if (refreshed) {
		renderDrivers();
		showToast('Drivers synced from database');
	}
}

init();