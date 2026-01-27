import { wireMainNav } from './navigation.js';

class Calendar {
  constructor() {
    this.currentView = 'day';
    this.currentDate = new Date();
    this.db = null;
    this.tooltipEl = null;
    this.modalEl = null;
    this.settingsStorageKey = 'relia_calendar_settings_anon';
    this.currentUser = null;
    this.availabilityStorageKey = 'relia_calendar_availability_events';
    this.refreshIntervalId = null;
    this.selectedFilters = {
      drivers: [],
      cars: [],
      vehicleTypes: [],
      statuses: []
    };
    this.init().catch(err => console.error('❌ Calendar init failed:', err));
  }

  async init() {
    await this.resolveUserSettingsKey();
    await this.loadDbModule();
    this.populateDateSelector();
    this.setupEventListeners();
    this.syncCurrentDateFromSelector();
    this.loadSettingsIntoUi();
    this.render();
    this.startAutoRefresh();
  }

  populateDateSelector() {
    const dateSelector = document.getElementById('dateSelector');
    if (!dateSelector) return;

    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();

    // Clear existing options
    dateSelector.innerHTML = '';

    // Generate months: 12 months back and 24 months forward
    const months = [];
    for (let offset = -12; offset <= 24; offset++) {
      const date = new Date(currentYear, currentMonth + offset, 1);
      const year = date.getFullYear();
      const month = date.getMonth();
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                          'July', 'August', 'September', 'October', 'November', 'December'];
      const value = `${year}-${String(month + 1).padStart(2, '0')}`;
      const label = `${year} - ${monthNames[month]}`;
      months.push({ value, label, isCurrent: offset === 0 });
    }

    // Add options
    months.forEach(m => {
      const option = document.createElement('option');
      option.value = m.value;
      option.textContent = m.label;
      if (m.isCurrent) {
        option.selected = true;
      }
      dateSelector.appendChild(option);
    });

    console.log('✅ Date selector populated with current month selected');
  }

  goToToday() {
    const today = new Date();
    this.currentDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    // Update the selector to current month
    const dateSelector = document.getElementById('dateSelector');
    if (dateSelector) {
      const value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
      dateSelector.value = value;
    }
    
    this.render();
    console.log('📅 Navigated to today:', today.toDateString());
  }

  // Auto-refresh calendar every 60 seconds to keep data current
  startAutoRefresh() {
    // Clear any existing interval
    if (this.refreshIntervalId) {
      clearInterval(this.refreshIntervalId);
    }
    
    // Refresh every 60 seconds
    this.refreshIntervalId = setInterval(() => {
      console.log('🔄 Auto-refreshing calendar...');
      this.render();
    }, 60000);
    
    // Also refresh on visibility change (when tab becomes visible again)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        console.log('👁️ Tab visible, refreshing calendar...');
        this.render();
      }
    });
  }

  async resolveUserSettingsKey() {
    // Keep calendar working even if auth/supabase isn't configured.
    try {
      const mod = await import('./supabase-client.js');
      const supabase = mod?.supabase;
      if (!supabase?.auth?.getUser) return;
      const { data } = await supabase.auth.getUser();
      const user = data?.user;
      if (user) {
        this.currentUser = {
          id: user.id || null,
          email: user.email || null,
          role: user.role || user.user_metadata?.role || user.app_metadata?.role || null
        };
      }
      const raw = user?.id || user?.email;
      if (raw) {
        const safe = String(raw).replace(/[^a-zA-Z0-9_.@-]/g, '_');
        this.settingsStorageKey = `relia_calendar_settings_${safe}`;
      }
    } catch {
      // ignore
    }
  }

  async loadDbModule() {
    try {
      const module = await import('./supabase-db.js');
      this.db = module.default;
      console.log('✅ Calendar Supabase database module loaded');
    } catch (error) {
      console.error('❌ Failed to load database module for calendar:', error);
      alert('⚠️ DATABASE CONNECTION FAILED\n\nPlease check your connection and reload.');
      this.db = null;
    }
  }

  setupEventListeners() {
    // Main navigation buttons
    wireMainNav();

    // View type buttons
    document.querySelectorAll('.view-type-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const view = e.target.dataset.view;
        this.switchView(view);
        this.saveSettingsFromUi();
      });
    });

    // Date selector
    const goToDateBtn = document.getElementById('goToDate');
    if (goToDateBtn) {
      goToDateBtn.addEventListener('click', () => {
        this.goToSelectedDate();
        this.saveSettingsFromUi();
      });
    }

    // Today button
    const goToTodayBtn = document.getElementById('goToToday');
    if (goToTodayBtn) {
      goToTodayBtn.addEventListener('click', () => {
        this.goToToday();
      });
    }

    const dateSelector = document.getElementById('dateSelector');
    if (dateSelector) {
      dateSelector.addEventListener('change', () => {
        // Keep simple: update the date but only re-render on "Go".
        this.syncCurrentDateFromSelector();
        this.saveSettingsFromUi();
      });
    }

    // Print button
    const printBtn = document.getElementById('printCalendar');
    if (printBtn) {
      printBtn.addEventListener('click', () => {
        this.printCalendar();
      });
    }

    // Mobile view checkbox
    const mobileViewCheckbox = document.getElementById('mobileView');
    if (mobileViewCheckbox) {
      mobileViewCheckbox.addEventListener('change', (e) => {
        this.toggleMobileView(e.target.checked);
        this.saveSettingsFromUi();
      });
    }

    // Filter checkboxes
    const onlyReservations = document.getElementById('onlyReservations');
    if (onlyReservations) {
      onlyReservations.addEventListener('change', (e) => {
        this.filterByReservations(e.target.checked);
        this.render();
        this.saveSettingsFromUi();
      });
    }

    const onlyMyEvents = document.getElementById('onlyMyEvents');
    if (onlyMyEvents) {
      onlyMyEvents.addEventListener('change', (e) => {
        this.filterByMyEvents(e.target.checked);
        this.render();
        this.saveSettingsFromUi();
      });
    }

    const showTicker = document.getElementById('showTicker');
    if (showTicker) {
      showTicker.addEventListener('change', () => {
        this.applyTickerVisibilityFromUi();
        this.updateHolidayTicker();
        this.saveSettingsFromUi();
      });
    }

    const showFederal = document.getElementById('showFederalHolidays');
    if (showFederal) {
      showFederal.addEventListener('change', () => {
        this.render();
        this.saveSettingsFromUi();
      });
    }

    const showMajor = document.getElementById('showMajorObservances');
    if (showMajor) {
      showMajor.addEventListener('change', () => {
        this.render();
        this.saveSettingsFromUi();
      });
    }

    // Launch filters button
    const launchBtn = document.getElementById('launchFilters');
    if (launchBtn) {
      launchBtn.addEventListener('click', () => {
        this.applyFilters();
        this.render();
        this.saveSettingsFromUi();
      });
    }

    // Persist filter dropdowns as they change
    ['driverFilter', 'carFilter', 'vehicleTypeFilter', 'statusFilter'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('change', () => {
        this.applyFilters();
        this.render();
        this.saveSettingsFromUi();
      });
    });
  }

  navigateToSection(section) {
    // Navigate to different main sections
    if (section === 'office') {
      window.location.href = 'my-office.html';
    } else if (section === 'accounts') {
      window.location.href = 'accounts.html';
    } else if (section === 'quotes') {
      window.location.href = 'quotes.html';
    } else if (section === 'calendar') {
      window.location.href = 'calendar.html';
    } else if (section === 'reservations') {
      window.location.href = 'reservations-list.html';
    } else {
      // Placeholder for other sections
      alert(`${section} section coming soon`);
    }
  }

  switchView(view) {
    // Update active view button
    document.querySelectorAll('.view-type-btn').forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.view === view) {
        btn.classList.add('active');
      }
    });

    this.currentView = view;
    console.log(`Switched to ${view} view`);

    // Only month view is rendered for now; keep UX minimal.
    this.render();
  }

  goToSelectedDate() {
    const dateSelector = document.getElementById('dateSelector');
    if (dateSelector) {
      const selectedDate = dateSelector.value;
      console.log('Going to date:', selectedDate);
      this.syncCurrentDateFromSelector();
      this.render();
    }
  }

  printCalendar() {
    console.log('Printing calendar...');
    window.print();
  }

  toggleMobileView(enabled) {
    console.log('Mobile view:', enabled);
    document.body.classList.toggle('calendar-mobile', !!enabled);
  }

  filterByReservations(enabled) {
    console.log('Only Reservations filter:', enabled);
    // In a real application, this would filter the calendar to show only reservations
  }

  filterByMyEvents(enabled) {
    console.log('Only My Events filter:', enabled);
    // In a real application, this would filter the calendar to show only user's events
  }

  applyFilters() {
    const driverFilter = document.getElementById('driverFilter')?.value;
    const carFilter = document.getElementById('carFilter')?.value;
    const vehicleTypeFilter = document.getElementById('vehicleTypeFilter')?.value;
    const statusFilter = document.getElementById('statusFilter')?.value;

    this.selectedFilters = {
      drivers: driverFilter ? [driverFilter] : [],
      cars: carFilter ? [carFilter] : [],
      vehicleTypes: vehicleTypeFilter ? [vehicleTypeFilter] : [],
      statuses: statusFilter ? [statusFilter] : []
    };

    console.log('Applying filters:', this.selectedFilters);
  }

  syncCurrentDateFromSelector() {
    const dateSelector = document.getElementById('dateSelector');
    if (!dateSelector) return;
    const value = String(dateSelector.value || '').trim();
    const m = value.match(/^(\d{4})-(\d{2})$/);
    if (!m) return;

    const year = Number(m[1]);
    const monthIndex = Number(m[2]) - 1;
    if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) return;
    this.currentDate = new Date(year, monthIndex, 1);
  }

  async render() {
    this.closeTooltip();
    this.closeModal();

    const calendarBody = document.getElementById('calendarBody');
    if (!calendarBody) {
      console.warn('⚠️ calendarBody not found');
      return;
    }

    const year = this.currentDate.getFullYear();
    const monthIndex = this.currentDate.getMonth();
    const firstOfMonth = new Date(year, monthIndex, 1);
    const start = new Date(year, monthIndex, 1 - firstOfMonth.getDay()); // Sunday start

    // Get today's date for highlighting
    const today = new Date();
    const todayKey = this.dateKey(today);

    const dayCellMap = new Map();

    // Build 6-week grid
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < 42; i++) {
      const cellDate = new Date(start);
      cellDate.setDate(start.getDate() + i);

      const cell = document.createElement('div');
      cell.className = 'calendar-cell';
      if (cellDate.getMonth() !== monthIndex) {
        cell.classList.add('empty-cell');
      }

      // Highlight today's date
      const cellKey = this.dateKey(cellDate);
      if (cellKey === todayKey) {
        cell.classList.add('today');
      }

      const dateEl = document.createElement('div');
      dateEl.className = 'cell-date';
      dateEl.textContent = String(cellDate.getDate());
      cell.appendChild(dateEl);

      const content = document.createElement('div');
      content.className = 'cell-content';
      cell.appendChild(content);

      // Allow adding availability on double-click of empty space
      // (Only useful when "Only Reservations" is OFF, since availability is hidden otherwise.)
      const dateKey = this.dateKey(cellDate);
      cell.dataset.dateKey = dateKey;
      content.dataset.dateKey = dateKey;
      const onEmptyDblClick = (e) => {
        if (e.target?.closest?.('.event-item')) return;
        if (cell.classList.contains('other-month')) return;
        this.promptCreateAvailability(dateKey);
      };
      // Bind on the whole cell so empty-space double-click works
      cell.addEventListener('dblclick', onEmptyDblClick);

      if (cellDate.getMonth() === monthIndex) {
        dayCellMap.set(dateKey, content);
      }

      fragment.appendChild(cell);
    }

    // Delete all events (and all cells) then re-add
    calendarBody.innerHTML = '';
    calendarBody.appendChild(fragment);

    // Add holidays / observances (hidden when "Only Reservations" is ON)
    const onlyReservations = document.getElementById('onlyReservations')?.checked ?? true;
    if (!onlyReservations) {
      const showFederal = document.getElementById('showFederalHolidays')?.checked ?? true;
      const showMajor = document.getElementById('showMajorObservances')?.checked ?? false;
      const holidayEvents = [
        ...(showFederal ? this.getUSHolidays(year) : []),
        ...(showMajor ? this.getMajorObservances(year) : [])
      ].filter(h => h?.date?.getMonth?.() === monthIndex);

      for (const h of holidayEvents) {
        const key = this.dateKey(h.date);
        const container = dayCellMap.get(key);
        if (!container) continue;

        const el = this.createHolidayEventEl(h);
        container.appendChild(el);
      }

      // Add availability events (drivers / booked-by)
      const availability = this.getAvailabilityForMonth(year, monthIndex);
      for (const ev of availability) {
        const el = this.createAvailabilityEventEl(ev);
        const container = dayCellMap.get(el.dataset.dateKey);
        if (!container) continue;
        container.appendChild(el);
      }
    }

    // Add reservations
    const reservations = await this.getReservationsForMonth(year, monthIndex);
    for (const res of reservations) {
      const el = this.createReservationEventEl(res);
      const container = dayCellMap.get(el.dataset.dateKey);
      if (!container) continue;
      container.appendChild(el);
    }

    this.updateHolidayTicker();
  }

  getAvailabilityForMonth(year, monthIndex) {
    const onlyMyEvents = document.getElementById('onlyMyEvents')?.checked ?? false;
    const userId = this.currentUser?.id;
    const userEmail = (this.currentUser?.email || '').toLowerCase();

    const all = this.loadAvailabilityEvents();
    return all
      .filter(e => e && e.start_at)
      .map(e => ({ raw: e, startDate: this.parseLocalDateTime(e.start_at) }))
      .filter(x => x.startDate && x.startDate.getFullYear() === year && x.startDate.getMonth() === monthIndex)
      .filter(x => {
        if (!onlyMyEvents) return true;
        if (!userId && !userEmail) return false;
        const createdById = x.raw.created_by_id ? String(x.raw.created_by_id) : '';
        const createdByEmail = (x.raw.created_by_email || '').toLowerCase();
        if (userId && createdById && createdById === String(userId)) return true;
        if (userEmail && createdByEmail && createdByEmail === userEmail) return true;
        return false;
      })
      .sort((a, b) => a.startDate - b.startDate)
      .map(x => x.raw);
  }

  loadAvailabilityEvents() {
    try {
      const raw = localStorage.getItem(this.availabilityStorageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.warn('⚠️ Failed to load availability events:', e);
      return [];
    }
  }

  saveAvailabilityEvents(events) {
    try {
      localStorage.setItem(this.availabilityStorageKey, JSON.stringify(events));
    } catch (e) {
      console.warn('⚠️ Failed to save availability events:', e);
    }
  }

  promptCreateAvailability(dateKey) {
    const onlyReservationsEl = document.getElementById('onlyReservations');
    const onlyReservations = onlyReservationsEl?.checked ?? true;
    // If user is creating availability, make it visible automatically.
    if (onlyReservationsEl && onlyReservations) {
      onlyReservationsEl.checked = false;
      try { this.filterByReservations(false); } catch { /* ignore */ }
      try { this.saveSettingsFromUi(); } catch { /* ignore */ }
      try { this.applyTickerVisibilityFromUi?.(); } catch { /* ignore */ }
    }

    if (!this.currentUser?.id && !this.currentUser?.email) {
      alert('Sign in required to create availability.');
      return;
    }

    const startTime = (prompt('Time START (HH:MM)', '09:00') || '').trim();
    if (!startTime) return;
    const timeIn = (prompt('Time IN (HH:MM, optional)', '') || '').trim();
    const timeStop = (prompt('Time STOP (HH:MM, optional)', '') || '').trim();
    const timeOut = (prompt('Time OUT (HH:MM)', '17:00') || '').trim();
    if (!timeOut) return;
    const note = prompt('Note (optional)', '') ?? '';

    if (!this.isValidHHMM(startTime) || !this.isValidHHMM(timeOut)) {
      alert('Invalid time format. Use HH:MM (e.g. 09:30).');
      return;
    }
    if (timeIn && !this.isValidHHMM(timeIn)) {
      alert('Invalid IN time. Use HH:MM (e.g. 10:15).');
      return;
    }
    if (timeStop && !this.isValidHHMM(timeStop)) {
      alert('Invalid STOP time. Use HH:MM (e.g. 12:00).');
      return;
    }

    const startAt = `${dateKey}T${startTime}`;
    const endAt = `${dateKey}T${timeOut}`;
    const startDate = this.parseLocalDateTime(startAt);
    const endDate = this.parseLocalDateTime(endAt);
    if (!startDate || !endDate) {
      alert('Invalid date/time.');
      return;
    }
    if (endDate <= startDate) {
      alert('OUT time must be after START time.');
      return;
    }

    const role = (this.currentUser?.role || '').toLowerCase();
    const ownerType = role === 'driver' ? 'driver' : 'booked-by';

    const newEvent = {
      id: `avail-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type: 'availability',
      owner_type: ownerType,
      created_by_id: this.currentUser?.id || null,
      created_by_email: this.currentUser?.email || null,
      start_time: startTime,
      in_time: timeIn || null,
      stop_time: timeStop || null,
      out_time: timeOut,
      start_at: startAt,
      end_at: endAt,
      note,
      created_at: new Date().toISOString()
    };

    const all = this.loadAvailabilityEvents();
    all.push(newEvent);
    this.saveAvailabilityEvents(all);
    this.render();
  }

  isAvailabilityOwner(ev) {
    const userId = this.currentUser?.id ? String(this.currentUser.id) : '';
    const userEmail = (this.currentUser?.email || '').toLowerCase();
    const createdById = ev?.created_by_id ? String(ev.created_by_id) : '';
    const createdByEmail = (ev?.created_by_email || '').toLowerCase();
    if (userId && createdById && userId === createdById) return true;
    if (userEmail && createdByEmail && userEmail === createdByEmail) return true;
    return false;
  }

  promptEditAvailability(eventId) {
    const all = this.loadAvailabilityEvents();
    const idx = all.findIndex(e => e && e.id === eventId);
    if (idx < 0) return;
    const ev = all[idx];

    if (!this.isAvailabilityOwner(ev)) {
      alert('Only the creator can edit this availability.');
      return;
    }

    const startDate = this.parseLocalDateTime(ev.start_at);
    const endDate = this.parseLocalDateTime(ev.end_at);
    const dateKey = startDate ? this.dateKey(startDate) : null;
    if (!startDate || !endDate || !dateKey) {
      alert('This availability event has invalid dates.');
      return;
    }

    const fmt24 = (d) => d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    const currentStart = (ev.start_time || fmt24(startDate)).toString();
    const currentIn = (ev.in_time || '').toString();
    const currentStop = (ev.stop_time || '').toString();
    const currentOut = (ev.out_time || fmt24(endDate)).toString();

    const startTime = (prompt('Edit Time START (HH:MM)', currentStart) || '').trim();
    if (!startTime) return;
    const timeIn = (prompt('Edit Time IN (HH:MM, optional)', currentIn) || '').trim();
    const timeStop = (prompt('Edit Time STOP (HH:MM, optional)', currentStop) || '').trim();
    const timeOut = (prompt('Edit Time OUT (HH:MM)', currentOut) || '').trim();
    if (!timeOut) return;
    const note = prompt('Edit Note (optional)', (ev.note || '').toString()) ?? '';

    if (!this.isValidHHMM(startTime) || !this.isValidHHMM(timeOut)) {
      alert('Invalid time format. Use HH:MM (e.g. 09:30).');
      return;
    }
    if (timeIn && !this.isValidHHMM(timeIn)) {
      alert('Invalid IN time. Use HH:MM (e.g. 10:15).');
      return;
    }
    if (timeStop && !this.isValidHHMM(timeStop)) {
      alert('Invalid STOP time. Use HH:MM (e.g. 12:00).');
      return;
    }

    const nextStartAt = `${dateKey}T${startTime}`;
    const nextEndAt = `${dateKey}T${timeOut}`;
    const nextStart = this.parseLocalDateTime(nextStartAt);
    const nextEnd = this.parseLocalDateTime(nextEndAt);
    if (!nextStart || !nextEnd) {
      alert('Invalid date/time.');
      return;
    }
    if (nextEnd <= nextStart) {
      alert('OUT time must be after START time.');
      return;
    }

    all[idx] = {
      ...ev,
      start_time: startTime,
      in_time: timeIn || null,
      stop_time: timeStop || null,
      out_time: timeOut,
      start_at: nextStartAt,
      end_at: nextEndAt,
      note,
      updated_at: new Date().toISOString()
    };

    this.saveAvailabilityEvents(all);
    this.render();
  }

  createAvailabilityEventEl(ev) {
    const startDate = this.parseLocalDateTime(ev.start_at);
    const endDate = this.parseLocalDateTime(ev.end_at);
    const dateKey = startDate ? this.dateKey(startDate) : '';

    const fmtShort = (d) => d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const startLabel = (ev.start_time || (startDate ? fmtShort(startDate) : '')).toString();
    const outLabel = (ev.out_time || (endDate ? fmtShort(endDate) : '')).toString();
    const timeLabel = (startLabel && outLabel) ? `${startLabel}-${outLabel}` : (startLabel || outLabel || '');

    const who = (ev.created_by_email || ev.created_by_id || '').toString();
    const note = (ev.note || '').toString();

    const el = document.createElement('div');
    el.className = 'event-item event-orange';
    el.dataset.type = 'availability';
    el.dataset.id = ev.id || '';
    el.dataset.dateKey = dateKey;
    el.dataset.time = timeLabel;
    el.dataset.who = who;
    el.dataset.note = note;

    el.innerHTML = `
      <div class="event-time">Availability</div>
      <div class="event-vehicle">${this.escapeHtml(timeLabel)}${who ? `, ${this.escapeHtml(who)}` : ''}</div>
    `;

    el.addEventListener('mouseenter', (e) => {
      const lines = ['Availability'];
      if (startLabel) lines.push(`START: ${startLabel}`);
      if (ev.in_time) lines.push(`IN: ${ev.in_time}`);
      if (ev.stop_time) lines.push(`STOP: ${ev.stop_time}`);
      if (outLabel) lines.push(`OUT: ${outLabel}`);
      if (who) lines.push(`By: ${who}`);
      if (note) lines.push(note);
      this.openTooltip(lines.join('\n'));
      this.positionTooltip(e);
    });
    el.addEventListener('mousemove', (e) => this.positionTooltip(e));
    el.addEventListener('mouseleave', () => this.closeTooltip());

    el.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const lines = [
        { label: 'Type', value: 'Availability' },
        { label: 'START', value: startLabel },
        { label: 'IN', value: (ev.in_time || '') },
        { label: 'STOP', value: (ev.stop_time || '') },
        { label: 'OUT', value: outLabel },
        { label: 'By', value: who },
        { label: 'Note', value: note }
      ].filter(x => x.value);

      // Reuse the calendar modal
      this.closeModal();
      const modal = document.createElement('div');
      modal.className = 'calendar-modal';
      modal.innerHTML = `
        <div class="calendar-modal-overlay"></div>
        <div class="calendar-modal-content" role="dialog" aria-modal="true">
          <div class="calendar-modal-header">
            <div class="calendar-modal-title">Availability</div>
            <button class="calendar-modal-close" type="button" aria-label="Close">×</button>
          </div>
          <div class="calendar-modal-body">
            ${lines.map(l => `
              <div class="calendar-modal-row">
                <div class="calendar-modal-label">${this.escapeHtml(l.label)}:</div>
                <div class="calendar-modal-value">${this.escapeHtml(l.value)}</div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
      const close = () => this.closeModal();
      modal.querySelector('.calendar-modal-overlay')?.addEventListener('click', close);
      modal.querySelector('.calendar-modal-close')?.addEventListener('click', close);

      document.addEventListener('keydown', this._onModalKeydown = (ev2) => {
        if (ev2.key === 'Escape') close();
      }, { once: true });

      document.body.appendChild(modal);
      this.modalEl = modal;
    });

    // Double-click to edit (owner only)
    el.addEventListener('dblclick', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = el.dataset.id;
      if (!id) return;
      this.promptEditAvailability(id);
    });

    return el;
  }

  isValidHHMM(value) {
    const s = String(value || '').trim();
    const m = s.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
    return !!m;
  }

  loadSettingsIntoUi() {
    try {
      const raw = localStorage.getItem(this.settingsStorageKey);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (!s || typeof s !== 'object') return;

      if (s.currentView) this.currentView = s.currentView;
      if (s.monthValue) {
        const sel = document.getElementById('dateSelector');
        if (sel) sel.value = s.monthValue;
        this.syncCurrentDateFromSelector();
      }

      const onlyRes = document.getElementById('onlyReservations');
      if (onlyRes && typeof s.onlyReservations === 'boolean') onlyRes.checked = s.onlyReservations;
      const onlyMy = document.getElementById('onlyMyEvents');
      if (onlyMy && typeof s.onlyMyEvents === 'boolean') onlyMy.checked = s.onlyMyEvents;

      const showTicker = document.getElementById('showTicker');
      if (showTicker && typeof s.showTicker === 'boolean') showTicker.checked = s.showTicker;
      const showFed = document.getElementById('showFederalHolidays');
      if (showFed && typeof s.showFederalHolidays === 'boolean') showFed.checked = s.showFederalHolidays;
      const showMajor = document.getElementById('showMajorObservances');
      if (showMajor && typeof s.showMajorObservances === 'boolean') showMajor.checked = s.showMajorObservances;

      this.applyTickerVisibilityFromUi();
      const mobile = document.getElementById('mobileView');
      if (mobile && typeof s.mobileView === 'boolean') {
        mobile.checked = s.mobileView;
        this.toggleMobileView(s.mobileView);
      }

      const setSelect = (id, v) => {
        const el = document.getElementById(id);
        if (el && v !== undefined && v !== null) el.value = v;
      };
      setSelect('driverFilter', s.driverFilter);
      setSelect('carFilter', s.carFilter);
      setSelect('vehicleTypeFilter', s.vehicleTypeFilter);
      setSelect('statusFilter', s.statusFilter);

      // Ensure view buttons reflect the loaded view
      document.querySelectorAll('.view-type-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === this.currentView);
      });

      this.applyFilters();
    } catch (e) {
      console.warn('⚠️ Failed to load calendar settings:', e);
    }
  }

  saveSettingsFromUi() {
    try {
      const dateSelector = document.getElementById('dateSelector');
      const settings = {
        currentView: this.currentView,
        monthValue: dateSelector?.value || null,
        onlyReservations: document.getElementById('onlyReservations')?.checked ?? true,
        onlyMyEvents: document.getElementById('onlyMyEvents')?.checked ?? false,
        showTicker: document.getElementById('showTicker')?.checked ?? false,
        showFederalHolidays: document.getElementById('showFederalHolidays')?.checked ?? true,
        showMajorObservances: document.getElementById('showMajorObservances')?.checked ?? false,
        mobileView: document.getElementById('mobileView')?.checked ?? false,
        driverFilter: document.getElementById('driverFilter')?.value ?? '',
        carFilter: document.getElementById('carFilter')?.value ?? '',
        vehicleTypeFilter: document.getElementById('vehicleTypeFilter')?.value ?? '',
        statusFilter: document.getElementById('statusFilter')?.value ?? ''
      };
      localStorage.setItem(this.settingsStorageKey, JSON.stringify(settings));
    } catch (e) {
      console.warn('⚠️ Failed to persist calendar settings:', e);
    }
  }

  applyTickerVisibilityFromUi() {
    const enabled = document.getElementById('showTicker')?.checked ?? false;
    document.body.classList.toggle('show-holiday-ticker', !!enabled);
  }

  updateHolidayTicker() {
    const track = document.getElementById('holidayTickerTrack');
    if (!track) return;

    const enabled = document.getElementById('showTicker')?.checked ?? false;
    if (!enabled) {
      track.innerHTML = '';
      return;
    }

    const showFederal = document.getElementById('showFederalHolidays')?.checked ?? true;
    const showMajor = document.getElementById('showMajorObservances')?.checked ?? false;

    const now = new Date();
    const horizon = new Date(now);
    horizon.setDate(horizon.getDate() + 120);
    const events = this.buildTickerItems({ showFederal, showMajor, now, horizon });

    if (events.length === 0) {
      track.textContent = 'No upcoming items';
      return;
    }

    const html = events
      .map(e => {
        const text = `${this.formatTickerDateTime(e.date)} — ${e.name}`;
        return `<span class="holiday-ticker-item"><span class="holiday-ticker-dot"></span>${this.escapeHtml(text)}</span>`;
      })
      .join('');

    // Duplicate the content for seamless looping
    track.innerHTML = html + html;
  }

  startOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  addDays(date, days, hours = 19, minutes = 30) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    d.setHours(hours, minutes, 0, 0);
    return d;
  }

  formatTickerDateTime(d) {
    if (!(d instanceof Date) || isNaN(d.getTime())) return '';
    const datePart = d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
    const timePart = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return `${datePart} ${timePart}`;
  }

  buildTickerItems({ showFederal, showMajor, now, horizon }) {
    const baseEvents = [
      ...(showFederal ? this.getUSHolidays(now.getFullYear()) : []),
      ...(showMajor ? this.getMajorObservances(now.getFullYear()) : []),
      ...(showFederal ? this.getUSHolidays(now.getFullYear() + 1) : []),
      ...(showMajor ? this.getMajorObservances(now.getFullYear() + 1) : [])
    ];

    const entertainmentAndSports = this.getEntertainmentAndSportsEvents(now);

    return [...baseEvents, ...entertainmentAndSports]
      .filter(e => e?.date instanceof Date && !isNaN(e.date.getTime()))
      .filter(e => e.date >= this.startOfDay(now) && e.date <= horizon)
      .sort((a, b) => a.date - b.date);
  }

  getEntertainmentAndSportsEvents(now) {
    const base = this.startOfDay(now);
    const items = [];

    const companyInfo = (() => {
      try {
        return JSON.parse(localStorage.getItem('companyInfo') || '{}');
      } catch {
        return {};
      }
    })();

    const settings = (() => {
      try {
        return JSON.parse(localStorage.getItem('relia_company_settings') || '{}');
      } catch {
        return {};
      }
    })();

    const manualLocation = (settings.tickerSearchCity || '').trim();
    const city = (companyInfo.city || companyInfo.companyCity || '').trim();
    const state = (companyInfo.state || companyInfo.companyState || '').trim();
    const cityState = manualLocation || [city, state].filter(Boolean).join(', ') || 'Local';

    const wrap = (label) => `${label} — ${cityState}`;

    const templates = [
      { label: 'Concert: Indie Night at Riverside Hall', offset: 3, hour: 19, minute: 30 },
      { label: 'Concert: Jazz Fest at Downtown Theater', offset: 9, hour: 18, minute: 0 },
      { label: 'Concert: Rock Block at City Arena', offset: 15, hour: 20, minute: 0 },
      { label: 'Concert: Acoustic Sessions at Garden Stage', offset: 28, hour: 19, minute: 0 },
      { label: 'NBA: Home Team vs. Conference Rival', offset: 5, hour: 19, minute: 0 },
      { label: 'NBA: Home Team vs. Divisional Opponent', offset: 12, hour: 19, minute: 30 },
      { label: 'NBA: Home Team vs. Interconference Matchup', offset: 26, hour: 19, minute: 0 },
      { label: 'NFL: Home Team vs. Conference Foe', offset: 7, hour: 13, minute: 0 },
      { label: 'NFL: Home Team vs. Divisional Rival', offset: 20, hour: 19, minute: 20 },
      { label: 'NHL: Home Team vs. Central Division', offset: 10, hour: 18, minute: 30 },
      { label: 'NHL: Home Team vs. Coastal Division', offset: 18, hour: 19, minute: 0 },
      { label: 'NSL: Home Club vs. West Division', offset: 14, hour: 17, minute: 30 },
      { label: 'NSL: Home Club vs. East Division', offset: 25, hour: 19, minute: 15 }
    ];

    templates.forEach(t => {
      items.push({ name: wrap(t.label), date: this.addDays(base, t.offset, t.hour, t.minute) });
    });

    return items;
  }

  async getReservationsForMonth(year, monthIndex) {
    if (!this.db) return [];
    let all = [];
    try {
      all = await this.db.getAllReservations() || [];
    } catch (e) {
      console.error('❌ Failed to load reservations from db:', e);
      return [];
    }

    // "Only Reservations" affects whether we show holidays; reservations always show.

    const onlyMyEvents = document.getElementById('onlyMyEvents')?.checked ?? false;

    const filtered = all
      .filter(r => r && r.pickup_at)
      .filter(r => {
        if (!onlyMyEvents) return true;
        const userId = this.currentUser?.id;
        const userEmail = (this.currentUser?.email || '').toLowerCase();
        if (!userId && !userEmail) return false;

        const driverId = this.getReservationDriverId(r);
        if (userId && driverId && String(driverId) === String(userId)) return true;

        const bookedByEmail = this.getReservationBookedByEmail(r);
        if (userEmail && bookedByEmail && bookedByEmail.toLowerCase() === userEmail) return true;

        return false;
      })
      .map(r => ({
        raw: r,
        pickupDate: this.parseLocalDateTime(r.pickup_at)
      }))
      .filter(x => x.pickupDate && x.pickupDate.getFullYear() === year && x.pickupDate.getMonth() === monthIndex)
      .sort((a, b) => a.pickupDate - b.pickupDate);

    return filtered.map(x => x.raw);
  }

  getReservationDriverId(res) {
    // Prefer explicit fields if present; fallback to form snapshot
    const direct = res?.driver_id || res?.driverId || res?.driver;
    if (direct) return direct;
    return res?.form_snapshot?.details?.driver || null;
  }

  getReservationBookedByEmail(res) {
    const direct = res?.booked_by_email || res?.bookedByEmail;
    if (direct) return String(direct);
    const snap = res?.form_snapshot?.bookedBy?.email;
    return snap ? String(snap) : null;
  }

  createReservationEventEl(res) {
    const pickupDate = this.parseLocalDateTime(res.pickup_at);
    const dateKey = this.dateKey(pickupDate);
    const timeLabel = pickupDate
      ? pickupDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      : '';

    const conf = String(res.confirmation_number || res.id || '').trim();
    const passenger = String(res.passenger_name || '').trim();
    const vehicle = String(res.vehicle_type || '').trim();
    const company = String(res.company_name || '').trim();
    const status = String(res.status || '').trim();

    const stops = Array.isArray(res.stops) ? res.stops : [];
    const pickupStop = stops.find(s => (s?.type || '').toLowerCase() === 'pickup') || stops[0] || null;
    const dropoffStop = stops.find(s => (s?.type || '').toLowerCase() === 'dropoff') || stops[1] || null;
    const pickupAddr = this.formatStop(pickupStop);
    const dropoffAddr = this.formatStop(dropoffStop);

    const el = document.createElement('div');
    el.className = 'event-item event-cyan';
    el.dataset.type = 'reservation';
    el.dataset.conf = conf;
    el.dataset.dateKey = dateKey;
    el.dataset.time = timeLabel;
    el.dataset.passenger = passenger;
    el.dataset.vehicle = vehicle;
    el.dataset.company = company;
    el.dataset.status = status;
    el.dataset.pickup = pickupAddr;
    el.dataset.dropoff = dropoffAddr;

    el.innerHTML = `
      <div class="event-time">${this.escapeHtml(timeLabel)}${conf ? `  #${this.escapeHtml(conf)}` : ''}</div>
      <div class="event-vehicle">${this.escapeHtml([vehicle, passenger].filter(Boolean).join(', '))}</div>
    `;

    this.attachReservationInteractions(el);
    return el;
  }

  createHolidayEventEl(holiday) {
    const el = document.createElement('div');
    el.className = 'event-item event-orange';
    el.dataset.type = 'holiday';
    el.dataset.dateKey = this.dateKey(holiday.date);
    el.dataset.name = holiday.name;
    el.dataset.kind = holiday.kind || 'Holiday';

    el.innerHTML = `
      <div class="event-time">${this.escapeHtml(el.dataset.kind)}</div>
      <div class="event-vehicle">${this.escapeHtml(holiday.name)}</div>
    `;

    // Tooltip on hover (no modal/nav required)
    el.addEventListener('mouseenter', (e) => {
      this.openTooltip(`${el.dataset.kind}: ${holiday.name}`);
      this.positionTooltip(e);
    });
    el.addEventListener('mousemove', (e) => this.positionTooltip(e));
    el.addEventListener('mouseleave', () => this.closeTooltip());

    return el;
  }

  attachReservationInteractions(el) {
    let clickTimer = null;
    const clickDelay = 250;

    el.addEventListener('mouseenter', (e) => {
      this.openTooltip(this.buildReservationTooltipText(el));
      this.positionTooltip(e);
    });
    el.addEventListener('mousemove', (e) => this.positionTooltip(e));
    el.addEventListener('mouseleave', () => this.closeTooltip());

    el.addEventListener('click', (e) => {
      e.preventDefault();
      if (clickTimer) clearTimeout(clickTimer);
      clickTimer = setTimeout(() => {
        this.openReservationModal(el);
        clickTimer = null;
      }, clickDelay);
    });

    el.addEventListener('dblclick', (e) => {
      e.preventDefault();
      if (clickTimer) {
        clearTimeout(clickTimer);
        clickTimer = null;
      }
      const conf = el.dataset.conf;
      if (conf) {
        window.location.href = `reservations-list.html?openConf=${encodeURIComponent(conf)}&src=calendar`;
      }
    });
  }

  buildReservationTooltipText(el) {
    const parts = [];
    const conf = el.dataset.conf;
    if (conf) parts.push(`#${conf}`);
    if (el.dataset.time) parts.push(el.dataset.time);
    if (el.dataset.passenger) parts.push(el.dataset.passenger);
    if (el.dataset.pickup) parts.push(`PU: ${el.dataset.pickup}`);
    if (el.dataset.dropoff) parts.push(`DO: ${el.dataset.dropoff}`);
    return parts.join('\n');
  }

  openReservationModal(el) {
    this.closeModal();

    const conf = el.dataset.conf || '';
    const title = conf ? `Reservation #${conf}` : 'Reservation';

    const lines = [
      { label: 'Time', value: el.dataset.time || '' },
      { label: 'Passenger', value: el.dataset.passenger || '' },
      { label: 'Company', value: el.dataset.company || '' },
      { label: 'Vehicle', value: el.dataset.vehicle || '' },
      { label: 'Status', value: el.dataset.status || '' },
      { label: 'Pickup', value: el.dataset.pickup || '' },
      { label: 'Dropoff', value: el.dataset.dropoff || '' }
    ].filter(x => x.value);

    const modal = document.createElement('div');
    modal.className = 'calendar-modal';
    modal.innerHTML = `
      <div class="calendar-modal-overlay"></div>
      <div class="calendar-modal-content" role="dialog" aria-modal="true">
        <div class="calendar-modal-header">
          <div class="calendar-modal-title">${this.escapeHtml(title)}</div>
          <button class="calendar-modal-close" type="button" aria-label="Close">×</button>
        </div>
        <div class="calendar-modal-body">
          ${lines.map(l => `
            <div class="calendar-modal-row">
              <div class="calendar-modal-label">${this.escapeHtml(l.label)}:</div>
              <div class="calendar-modal-value">${this.escapeHtml(l.value)}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    const close = () => this.closeModal();
    modal.querySelector('.calendar-modal-overlay')?.addEventListener('click', close);
    modal.querySelector('.calendar-modal-close')?.addEventListener('click', close);

    document.addEventListener('keydown', this._onModalKeydown = (e) => {
      if (e.key === 'Escape') close();
    }, { once: true });

    document.body.appendChild(modal);
    this.modalEl = modal;
  }

  closeModal() {
    if (this.modalEl) {
      try { this.modalEl.remove(); } catch { /* ignore */ }
      this.modalEl = null;
    }
  }

  openTooltip(text) {
    this.closeTooltip();
    const tip = document.createElement('div');
    tip.className = 'calendar-tooltip';
    tip.textContent = text;
    document.body.appendChild(tip);
    this.tooltipEl = tip;
  }

  positionTooltip(e) {
    if (!this.tooltipEl) return;
    const offset = 12;
    const x = (e?.clientX ?? 0) + offset;
    const y = (e?.clientY ?? 0) + offset;
    this.tooltipEl.style.left = `${x}px`;
    this.tooltipEl.style.top = `${y}px`;
  }

  closeTooltip() {
    if (this.tooltipEl) {
      try { this.tooltipEl.remove(); } catch { /* ignore */ }
      this.tooltipEl = null;
    }
  }

  dateKey(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  parseLocalDateTime(value) {
    if (!value) return null;
    // Accept: YYYY-MM-DD or YYYY-MM-DDTHH:mm
    const s = String(value).trim();
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
    if (!m) {
      const d = new Date(s);
      return isNaN(d.getTime()) ? null : d;
    }
    const year = Number(m[1]);
    const monthIndex = Number(m[2]) - 1;
    const day = Number(m[3]);
    const hh = Number(m[4] ?? 0);
    const mm = Number(m[5] ?? 0);
    const d = new Date(year, monthIndex, day, hh, mm, 0, 0);
    return isNaN(d.getTime()) ? null : d;
  }

  formatStop(stop) {
    if (!stop) return '';
    const parts = [];
    const name = (stop.locationName || stop.name || '').toString().trim();
    const addr1 = (stop.address1 || stop.address || '').toString().trim();
    const city = (stop.city || '').toString().trim();
    const state = (stop.state || '').toString().trim();
    if (name) parts.push(name);
    if (addr1) parts.push(addr1);
    const cityState = [city, state].filter(Boolean).join(', ');
    if (cityState) parts.push(cityState);
    return parts.join(' • ');
  }

  escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // US Federal holidays (basic set)
  getUSHolidays(year) {
    const fixed = (monthIndex, day, name) => ({
      name,
      date: new Date(year, monthIndex, day),
      kind: 'Federal Holiday'
    });

    const nthWeekday = (monthIndex, weekday, n, name) => {
      // weekday: 0=Sun..6=Sat, n: 1..5
      const first = new Date(year, monthIndex, 1);
      const offset = (weekday - first.getDay() + 7) % 7;
      const day = 1 + offset + (n - 1) * 7;
      return { name, date: new Date(year, monthIndex, day), kind: 'Federal Holiday' };
    };

    const lastWeekday = (monthIndex, weekday, name) => {
      const last = new Date(year, monthIndex + 1, 0);
      const offset = (last.getDay() - weekday + 7) % 7;
      last.setDate(last.getDate() - offset);
      return { name, date: last, kind: 'Federal Holiday' };
    };

    return [
      fixed(0, 1, "New Year's Day"),
      nthWeekday(0, 1, 3, 'Martin Luther King Jr. Day'), // 3rd Monday Jan
      nthWeekday(1, 1, 3, "Presidents' Day"), // 3rd Monday Feb
      lastWeekday(4, 1, 'Memorial Day'), // last Monday May
      fixed(5, 19, 'Juneteenth'),
      fixed(6, 4, 'Independence Day'),
      nthWeekday(8, 1, 1, 'Labor Day'), // 1st Monday Sep
      nthWeekday(9, 1, 2, 'Columbus Day'), // 2nd Monday Oct
      fixed(10, 11, "Veterans Day"),
      nthWeekday(10, 4, 4, 'Thanksgiving Day'), // 4th Thursday Nov
      fixed(11, 25, 'Christmas Day')
    ];
  }

  // Major observances (non-federal) used for ticker + optional awareness
  getMajorObservances(year) {
    const fixed = (monthIndex, day, name) => ({ name, date: new Date(year, monthIndex, day), kind: 'Major Observance' });
    const nthWeekday = (monthIndex, weekday, n, name) => {
      const first = new Date(year, monthIndex, 1);
      const offset = (weekday - first.getDay() + 7) % 7;
      const day = 1 + offset + (n - 1) * 7;
      return { name, date: new Date(year, monthIndex, day), kind: 'Major Observance' };
    };

    return [
      // January
      fixed(0, 2, "New Year's Day (Observed)"), // When Jan 1 falls on Sun
      // February
      fixed(1, 2, 'Groundhog Day'),
      fixed(1, 14, "Valentine's Day"),
      nthWeekday(1, 0, 2, 'Super Bowl Sunday'), // 2nd Sunday Feb (approximate)
      // March
      fixed(2, 17, "St. Patrick's Day"),
      this.getDaylightSavingStart(year), // Spring forward
      // April
      this.getEasterSunday(year),
      this.getGoodFriday(year),
      fixed(3, 15, 'Tax Day'),
      fixed(3, 22, 'Earth Day'),
      // May
      fixed(4, 5, 'Cinco de Mayo'),
      nthWeekday(4, 0, 2, "Mother's Day"), // 2nd Sunday May
      // June
      fixed(5, 14, 'Flag Day'),
      nthWeekday(5, 0, 3, "Father's Day"), // 3rd Sunday Jun
      // September
      nthWeekday(8, 0, 2, 'Grandparents Day'), // Sunday after Labor Day
      fixed(8, 11, 'Patriot Day'),
      // October
      nthWeekday(9, 1, 2, 'Indigenous Peoples Day'), // 2nd Monday Oct (same as Columbus Day)
      fixed(9, 31, 'Halloween'),
      // November
      this.getDaylightSavingEnd(year), // Fall back
      this.getElectionDay(year),
      this.getBlackFriday(year),
      // December
      fixed(11, 7, 'Pearl Harbor Remembrance Day'),
      fixed(11, 24, 'Christmas Eve'),
      fixed(11, 26, 'Kwanzaa Begins'),
      fixed(11, 31, "New Year's Eve")
    ].filter(Boolean);
  }

  getGoodFriday(year) {
    const easter = this.getEasterSunday(year);
    const goodFriday = new Date(easter.date);
    goodFriday.setDate(goodFriday.getDate() - 2);
    return { name: 'Good Friday', date: goodFriday, kind: 'Major Observance' };
  }

  getBlackFriday(year) {
    // Day after Thanksgiving (4th Thursday of November)
    const first = new Date(year, 10, 1);
    const offset = (4 - first.getDay() + 7) % 7; // Thursday = 4
    const thanksgiving = 1 + offset + 3 * 7; // 4th Thursday
    return { name: 'Black Friday', date: new Date(year, 10, thanksgiving + 1), kind: 'Major Observance' };
  }

  getDaylightSavingStart(year) {
    // 2nd Sunday of March
    const first = new Date(year, 2, 1);
    const offset = (0 - first.getDay() + 7) % 7; // Sunday = 0
    const day = 1 + offset + 7; // 2nd Sunday
    return { name: 'Daylight Saving Time Begins', date: new Date(year, 2, day), kind: 'Major Observance' };
  }

  getDaylightSavingEnd(year) {
    // 1st Sunday of November
    const first = new Date(year, 10, 1);
    const offset = (0 - first.getDay() + 7) % 7; // Sunday = 0
    const day = 1 + offset; // 1st Sunday
    return { name: 'Daylight Saving Time Ends', date: new Date(year, 10, day), kind: 'Major Observance' };
  }

  getEasterSunday(year) {
    // Anonymous Gregorian algorithm
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31); // 3=March, 4=April
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return { name: 'Easter Sunday', date: new Date(year, month - 1, day), kind: 'Major Observance' };
  }

  getElectionDay(year) {
    // First Tuesday after the first Monday in November
    const nov1 = new Date(year, 10, 1);
    const firstMondayOffset = (1 - nov1.getDay() + 7) % 7;
    const firstMonday = new Date(year, 10, 1 + firstMondayOffset);
    const firstTuesdayAfter = new Date(firstMonday);
    firstTuesdayAfter.setDate(firstMonday.getDate() + 1);
    return { name: 'Election Day (US)', date: firstTuesdayAfter, kind: 'Major Observance' };
  }
}

// Initialize the calendar
const calendar = new Calendar();
