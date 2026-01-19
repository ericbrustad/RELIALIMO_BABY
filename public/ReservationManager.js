const ENV_CONFIG = (typeof window !== 'undefined' && window.ENV) ? window.ENV : {};

function toTrimmedString(value) {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : null;
  }
  if (typeof value === 'object') {
    const nested = value.id || value.value;
    return toTrimmedString(nested);
  }
  const fallback = String(value).trim();
  return fallback.length > 0 ? fallback : null;
}

const ACTIVE_ORGANIZATION_ID = (() => {
  const candidates = [
    ENV_CONFIG.SUPABASE_UUID,
    ENV_CONFIG.SUPABASE_ORGANIZATION_ID,
    ENV_CONFIG.ORGANIZATION_ID,
    ENV_CONFIG.ORG_ID
  ];
  for (const candidate of candidates) {
    const normalized = toTrimmedString(candidate);
    if (normalized) {
      return normalized;
    }
  }
  return null;
})();

function resolveReservationOrg(reservation) {
  if (!reservation || typeof reservation !== 'object') {
    return null;
  }

  const candidates = [
    reservation.organization_id,
    reservation.organizationId,
    reservation.organization?.id,
    reservation.org_id,
    reservation.orgId,
    reservation.org?.id,
    reservation.raw?.organization_id,
    reservation.raw?.organizationId,
    reservation.raw?.organization?.id,
    reservation.form_snapshot?.organization_id,
    reservation.form_snapshot?.organizationId,
    reservation.form_snapshot?.organization?.id,
    reservation.form_snapshot?.details?.organization_id,
    reservation.form_snapshot?.details?.organizationId,
    reservation.form_snapshot?.details?.organization?.id,
    reservation.details?.organization_id,
    reservation.details?.organizationId
  ];

  for (const candidate of candidates) {
    const normalized = toTrimmedString(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

function preferReservation(existing, incoming) {
  if (!existing) return incoming;
  if (!incoming) return existing;

  const existingOrg = resolveReservationOrg(existing);
  const incomingOrg = resolveReservationOrg(incoming);

  if (ACTIVE_ORGANIZATION_ID) {
    const incomingMatches = incomingOrg === ACTIVE_ORGANIZATION_ID;
    const existingMatches = existingOrg === ACTIVE_ORGANIZATION_ID;

    if (incomingMatches && !existingMatches) {
      return incoming;
    }

    if (!incomingMatches && existingMatches) {
      return existing;
    }
  }

  const existingUpdated = Date.parse(existing.updatedAt || existing.updated_at || existing.modified_at || existing.modifiedAt || existing.createdAt || existing.created_at || 0) || 0;
  const incomingUpdated = Date.parse(incoming.updatedAt || incoming.updated_at || incoming.modified_at || incoming.modifiedAt || incoming.createdAt || incoming.created_at || 0) || 0;

  return incomingUpdated > existingUpdated ? incoming : existing;
}

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

const FARMOUT_STATUS_LABELS = {
  unassigned: 'Farm-out Unassigned',
  farm_out_unassigned: 'Farm-out Unassigned',
  farmout_unassigned: 'Farm-out Unassigned',
  offered: 'Farm-out Offered',
  assigned: 'Farm-out Assigned',
  farm_out_assigned: 'Farm-out Assigned',
  farmout_assigned: 'Farm-out Assigned',
  declined: 'Farm-out Declined',
  enroute: 'Farm-out En Route',
  en_route: 'Farm-out En Route',
  arrived: 'Farm-out Arrived',
  passenger_onboard: 'Passenger On Board',
  passenger_on_board: 'Passenger On Board',
  completed: 'Farm-out Completed',
  in_house: 'In-house Dispatch',
  inhouse: 'In-house Dispatch',
  offered_to_affiliate: 'Offered to Affiliate',
  affiliate_assigned: 'Affiliate Assigned',
  affiliate_driver_assigned: 'Affiliate Driver Assigned',
  driver_en_route: 'Driver En Route',
  on_the_way: 'Driver On The Way',
  driver_waiting_at_pickup: 'Driver Waiting at Pickup',
  waiting_at_pickup: 'Waiting at Pickup',
  driver_circling: 'Driver Circling',
  customer_in_car: 'Customer In Car',
  driving_passenger: 'Driving Passenger',
  cancelled: 'Farm-out Cancelled',
  cancelled_by_affiliate: 'Cancelled by Affiliate',
  late_cancel: 'Late Cancel',
  late_cancelled: 'Late Cancelled',
  no_show: 'No Show',
  covid19_cancellation: 'COVID-19 Cancellation',
  done: 'Trip Done'
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

function canonicalizeFarmoutMode(mode) {
  if (!mode) {
    return 'manual';
  }
  const normalized = normalizeFarmoutKey(mode);
  if (normalized === 'auto' || normalized === 'auto_dispatch' || normalized === 'automatic_dispatch') {
    return 'automatic';
  }
  if (normalized === 'automatic' || normalized === 'manual') {
    return normalized;
  }
  return normalized || 'manual';
}

function formatFarmoutStatus(status) {
  const canonical = canonicalizeFarmoutStatus(status);
  if (!canonical) {
    return FARMOUT_STATUS_LABELS.unassigned;
  }

  if (Object.prototype.hasOwnProperty.call(FARMOUT_STATUS_LABELS, canonical)) {
    return FARMOUT_STATUS_LABELS[canonical];
  }

  return canonical
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function applyFarmoutMetadata(reservation, status, mode) {
  if (!reservation) {
    return;
  }

  if (status !== undefined && status !== null) {
    const canonicalStatus = canonicalizeFarmoutStatus(status) || 'unassigned';
    const statusLabel = formatFarmoutStatus(canonicalStatus);

    reservation.farmoutStatus = canonicalStatus;
    reservation.farmout_status = canonicalStatus;
    reservation.efarmStatus = statusLabel;
    reservation.efarm_status = statusLabel;

    if (reservation.form_snapshot && typeof reservation.form_snapshot === 'object') {
      const details = reservation.form_snapshot.details = reservation.form_snapshot.details || {};
      details.efarmStatus = statusLabel;
      details.eFarmStatus = statusLabel;
      details.farmoutStatusCanonical = canonicalStatus;
    }
  }

  if (mode !== undefined && mode !== null) {
    const canonicalMode = canonicalizeFarmoutMode(mode || 'manual');

    reservation.farmoutMode = canonicalMode;
    reservation.farmout_mode = canonicalMode;
    reservation.efarm_out_selection = canonicalMode;
    reservation.eFarmOut = canonicalMode;

    if (reservation.form_snapshot && typeof reservation.form_snapshot === 'object') {
      const details = reservation.form_snapshot.details = reservation.form_snapshot.details || {};
      details.farmoutMode = canonicalMode;
      details.eFarmOut = canonicalMode;
    }
  }
}

export class ReservationManager {
  constructor() {
    this.reservations = [];
    this.nextId = 1;
    this.loadSettingsFromManager();
  }
  /**
   * Load reservation settings from settings manager or fall back to defaults.
   */
  loadSettingsFromManager() {
    // Defaults ensure sane behavior even if settings are unavailable.
    this.requirePaymentUpfront = false;
    this.requireAdvanceHours = 0;
    this.cancellationPolicyHours = 2;
    this.noShowFeePercent = 50;
    this.maxPassengers = 6;

    try {
      if (window.RESERVATION_CONFIG) {
        const config = window.RESERVATION_CONFIG;
        this.requirePaymentUpfront = Boolean(config.requirePaymentUpfront);
        this.requireAdvanceHours = Number(config.requireAdvanceHours) || 0;
        this.cancellationPolicyHours = Number(config.cancellationPolicyHours) || 2;
        this.noShowFeePercent = Number(config.noShowFeePercent) || 50;
        this.maxPassengers = Number(config.maxPassengers) || 6;
        return;
      }

      if (window.CompanySettingsManager) {
        const settingsManager = new window.CompanySettingsManager();
        this.requirePaymentUpfront = Boolean(settingsManager.getSetting('requirePaymentUpfront'));
        this.requireAdvanceHours = Number(settingsManager.getSetting('requireAdvanceHours')) || 0;
        this.cancellationPolicyHours = Number(settingsManager.getSetting('cancellationPolicyHours')) || 2;
        this.noShowFeePercent = Number(settingsManager.getSetting('noShowFeePercent')) || 50;
        this.maxPassengers = Number(settingsManager.getSetting('maxPassengers')) || 6;
      }
    } catch (error) {
      console.warn('[ReservationManager] Could not load settings from manager:', error);
    }
  }

  addReservation(reservationData) {
    const baseId = toTrimmedString(reservationData?.id)
      || toTrimmedString(reservationData?.confirmationNumber)
      || toTrimmedString(reservationData?.confirmation_number);

    const assignedId = baseId || toTrimmedString(this.nextId);

    const reservation = {
      id: assignedId || this.nextId,
      createdAt: new Date().toISOString(),
      status: reservationData.status || 'pending',
      farmoutStatus: 'unassigned',
      farmoutMode: 'manual',
      driverId: null,
      driverSnapshot: null,
      ...reservationData
    };

    const resolvedOrg = resolveReservationOrg(reservation) || ACTIVE_ORGANIZATION_ID;
    if (resolvedOrg) {
      reservation.organization_id = resolvedOrg;
    }

    const identifier = toTrimmedString(reservation.id) || toTrimmedString(reservation.confirmationNumber) || toTrimmedString(reservation.confirmation_number);
    let existingIndex = -1;
    if (identifier) {
      existingIndex = this.reservations.findIndex(r => {
        const existingId = toTrimmedString(r.id) || toTrimmedString(r.confirmationNumber) || toTrimmedString(r.confirmation_number);
        return existingId && existingId === identifier;
      });
    }

    const initialStatusCandidate = reservation.farmoutStatus || reservation.farmout_status || reservationData.farmout_status;
    const initialModeCandidate = reservation.farmoutMode || reservation.farmout_mode || reservationData.farmout_mode;

    reservation.farmoutStatus = canonicalizeFarmoutStatus(initialStatusCandidate || 'unassigned') || 'unassigned';
    reservation.farmoutMode = canonicalizeFarmoutMode(initialModeCandidate || 'manual');
    applyFarmoutMetadata(reservation, reservation.farmoutStatus, reservation.farmoutMode);
    if (typeof reservation.driverId === 'undefined') {
      reservation.driverId = null;
    }
    if (!reservation.driverSnapshot) {
      reservation.driverSnapshot = null;
    }

    if (existingIndex >= 0) {
      const merged = preferReservation(this.reservations[existingIndex], reservation);
      merged.farmoutStatus = canonicalizeFarmoutStatus(merged.farmoutStatus || merged.farmout_status || 'unassigned') || 'unassigned';
      merged.farmoutMode = canonicalizeFarmoutMode(merged.farmoutMode || merged.farmout_mode || 'manual');
      applyFarmoutMetadata(merged, merged.farmoutStatus, merged.farmoutMode);
      if (typeof merged.driverId === 'undefined') {
        merged.driverId = null;
      }
      if (!merged.driverSnapshot) {
        merged.driverSnapshot = null;
      }
      this.reservations[existingIndex] = merged;
      return merged;
    }

    if (!baseId) {
      this.nextId += 1;
    }

    this.reservations.push(reservation);
    return reservation;
  }

  getReservationById(id) {
    const key = toTrimmedString(id);
    if (!key) {
      return this.reservations.find(r => String(r.id) === String(id));
    }

    for (let i = this.reservations.length - 1; i >= 0; i--) {
      const candidate = this.reservations[i];
      const candidateKey = toTrimmedString(candidate?.id) || toTrimmedString(candidate?.confirmationNumber) || toTrimmedString(candidate?.confirmation_number);
      if (candidateKey && candidateKey === key) {
        return candidate;
      }
    }

    return null;
  }

  getAllReservations() {
    const map = new Map();
    const ordered = [];

    this.reservations.forEach(reservation => {
      if (!reservation) return;
      const key = toTrimmedString(reservation.id) || toTrimmedString(reservation.confirmationNumber) || toTrimmedString(reservation.confirmation_number);
      if (!key) {
        ordered.push(reservation);
        return;
      }

      if (!map.has(key)) {
        map.set(key, reservation);
        return;
      }

      const preferred = preferReservation(map.get(key), reservation);
      map.set(key, preferred);
    });

    return [...map.values(), ...ordered];
  }

  getReservationsByStatus(status) {
    return this.reservations.filter(r => r.status === status);
  }

  acceptReservation(id, driverName) {
    const reservation = this.getReservationById(id);
    if (reservation && reservation.status === 'pending') {
      reservation.status = 'accepted';
      reservation.driverName = driverName;
      reservation.acceptedAt = new Date().toISOString();
      return true;
    }
    return false;
  }

  completeReservation(id) {
    const reservation = this.getReservationById(id);
    if (reservation && reservation.status === 'accepted') {
      reservation.status = 'completed';
      reservation.completedAt = new Date().toISOString();
      return true;
    }
    return false;
  }

  updateReservation(id, updates) {
    const reservation = this.getReservationById(id);
    if (reservation) {
      Object.assign(reservation, updates);
      reservation.farmoutStatus = canonicalizeFarmoutStatus(reservation.farmoutStatus || reservation.farmout_status || 'unassigned') || 'unassigned';
      reservation.farmoutMode = canonicalizeFarmoutMode(reservation.farmoutMode || reservation.farmout_mode || 'manual');
      applyFarmoutMetadata(reservation, reservation.farmoutStatus, reservation.farmoutMode);
      if (typeof reservation.driverId === 'undefined') {
        reservation.driverId = null;
      }
      if (!reservation.driverSnapshot) {
        reservation.driverSnapshot = null;
      }
      this.emitFarmoutEvent(reservation, 'reservationUpdated');
      return true;
    }
    return false;
  }

  deleteReservation(id) {
    const index = this.reservations.findIndex(r => r.id === id);
    if (index !== -1) {
      this.reservations.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Validate reservation against company settings
   */
  validateReservation(reservationData) {
    const errors = [];

    // Check passenger count
    if (reservationData.passengers && reservationData.passengers > this.maxPassengers) {
      errors.push(`Maximum ${this.maxPassengers} passengers allowed per vehicle`);
    }

    // Check advance reservation requirement
    if (this.requireAdvanceHours > 0) {
      const pickupTime = new Date(reservationData.pickupTime);
      const now = new Date();
      const hoursAhead = (pickupTime - now) / (1000 * 60 * 60);
      
      if (hoursAhead < this.requireAdvanceHours) {
        errors.push(`Reservations must be made at least ${this.requireAdvanceHours} hours in advance`);
      }
    }

    // Check payment requirement
    if (this.requirePaymentUpfront && reservationData.paymentStatus !== 'paid') {
      errors.push('Payment is required upfront for this reservation');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Calculate cancellation fee based on settings
   */
  calculateCancellationFee(reservation, feePercent = null) {
    const percent = feePercent !== null ? feePercent : this.noShowFeePercent;
    const cost = reservation.cost || 0;
    return (cost * percent) / 100;
  }

  setFarmoutMode(id, mode) {
    const reservation = this.getReservationById(id);
    if (!reservation) return false;

    const canonicalMode = canonicalizeFarmoutMode(mode);
    const currentStatus = canonicalizeFarmoutStatus(reservation.farmout_status || reservation.farmoutStatus || 'unassigned');
    
    // Determine new farmout_status based on mode change
    let newStatus = currentStatus;
    
    if (canonicalMode === 'in_house' || canonicalMode === 'farm_in') {
      // Switching to in-house/farm-in: convert farmout statuses to regular statuses
      if (currentStatus === 'farmout_unassigned' || currentStatus === 'offered') {
        newStatus = 'unassigned';
      } else if (currentStatus === 'farmout_assigned') {
        newStatus = 'assigned';
      }
      // If already 'unassigned' or 'assigned', keep as-is
    } else if (canonicalMode === 'farm_out' || canonicalMode === 'manual' || canonicalMode === 'automatic') {
      // Switching to farmout: convert regular statuses to farmout statuses
      if (currentStatus === 'unassigned') {
        newStatus = 'farmout_unassigned';
      } else if (currentStatus === 'assigned') {
        newStatus = 'farmout_assigned';
      }
      // If already farmout status, keep as-is
    }
    
    applyFarmoutMetadata(reservation, newStatus, canonicalMode);
    
    // Persist to database
    if (reservation.id && typeof window.updateReservation === 'function') {
      window.updateReservation(reservation.id, {
        farmout_mode: canonicalMode,
        farmout_status: newStatus
      }).then(() => {
        // Dispatch event to update farmout table immediately
        document.dispatchEvent(new CustomEvent('farmoutModeChanged', {
          detail: { reservationId: reservation.id, mode: canonicalMode, status: newStatus }
        }));
      }).catch(err => console.warn('Failed to persist farmout mode:', err));
    } else {
      // Still dispatch event for UI updates even without DB save
      document.dispatchEvent(new CustomEvent('farmoutModeChanged', {
        detail: { reservationId: reservation.id, mode: canonicalMode, status: newStatus }
      }));
    }
    
    this.emitFarmoutEvent(reservation, 'farmoutModeChanged', { mode: canonicalMode, status: newStatus });
    return true;
  }

  updateFarmoutStatus(id, status) {
    const reservation = this.getReservationById(id);
    if (!reservation) return false;

    const canonicalStatus = canonicalizeFarmoutStatus(status) || 'unassigned';
    applyFarmoutMetadata(reservation, canonicalStatus, null);
    
    // Also update the main status field to reflect farmout state
    const mainStatus = canonicalStatus === 'assigned' ? 'farmout assigned' : 'farmout unassigned';
    reservation.status = mainStatus;
    
    // Persist to database
    if (reservation.id && typeof window.updateReservation === 'function') {
      window.updateReservation(reservation.id, {
        farmout_status: canonicalStatus,
        status: mainStatus
      }).catch(err => console.warn('Failed to persist farmout status:', err));
    }
    
    this.emitFarmoutEvent(reservation, 'farmoutStatusChanged', { status: canonicalStatus });
    return true;
  }

  assignFarmoutDriver(id, driverInfo) {
    const reservation = this.getReservationById(id);
    if (!reservation) return false;

    const previousDriverId = reservation.driverId;
    reservation.driverId = driverInfo?.id ?? null;
    reservation.driverSnapshot = driverInfo
      ? {
          id: driverInfo.id ?? null,
          name: driverInfo.name ?? '',
          affiliate: driverInfo.affiliate ?? '',
          phone: driverInfo.phone ?? '',
          vehicleType: driverInfo.vehicleType ?? ''
        }
      : null;
    reservation.driverName = reservation.driverSnapshot?.name || reservation.driverName || '';
    const statusAfterAssignment = reservation.driverId ? 'assigned' : 'unassigned';
    reservation.farmoutStatus = canonicalizeFarmoutStatus(statusAfterAssignment) || statusAfterAssignment;
    applyFarmoutMetadata(reservation, reservation.farmoutStatus, null);
    reservation.status = reservation.driverId ? 'accepted' : reservation.status;

    this.emitFarmoutEvent(reservation, 'farmoutDriverAssigned', {
      driverInfo: reservation.driverSnapshot,
      previousDriverId,
      status: reservation.farmoutStatus
    });
    return true;
  }

  clearFarmoutAssignment(id) {
    const reservation = this.getReservationById(id);
    if (!reservation) return false;

    const previousDriverId = reservation.driverId;
    reservation.driverId = null;
    reservation.driverSnapshot = null;
    reservation.driverName = '';
    reservation.farmoutStatus = canonicalizeFarmoutStatus('unassigned') || 'unassigned';
    applyFarmoutMetadata(reservation, reservation.farmoutStatus, null);
    this.emitFarmoutEvent(reservation, 'farmoutDriverCleared', { previousDriverId, status: reservation.farmoutStatus });
    return true;
  }

  emitFarmoutEvent(reservation, type, extra = {}) {
    try {
      window.dispatchEvent(new CustomEvent('reservationFarmoutUpdated', {
        detail: {
          type,
          reservation,
          ...extra
        }
      }));
    } catch (error) {
      console.warn('[ReservationManager] Unable to emit farmout event:', error);
    }
  }

  getVehicleTypeLabel(type) {
    const labels = {
      sedan: 'Sedan',
      suv: 'SUV Limousine',
      stretch: 'Stretch Limousine',
      luxury: 'Luxury Sedan'
    };
    return labels[type] || type;
  }

  getStatusColor(status) {
    const colors = {
      pending: '#ffa726',
      accepted: '#4caf50',
      completed: '#78909c'
    };
    return colors[status] || '#666';
  }
}
