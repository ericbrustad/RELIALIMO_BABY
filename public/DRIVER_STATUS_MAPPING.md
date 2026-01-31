# Driver Status Mapping Reference

This document defines the canonical status values used across the three systems:
1. **Driver App** (React Native mobile app)
2. **Farmout Reservations** (index-reservations.html - Farmout panel)
3. **Reservation Form** (reservation-form.html - main booking form)

## Canonical Driver Statuses (Driver App)

The Driver App uses these **9 canonical statuses** for trip progression:

| Status | Description | Display Label |
|--------|-------------|---------------|
| `getting_ready` | Driver has accepted, preparing to depart | READY |
| `enroute` | Driver is on the way to pickup location | ER |
| `arrived` | Driver has arrived at pickup location | ARR |
| `waiting` | Driver is waiting for passenger (countdown active) | WAIT |
| `passenger_onboard` | Passenger is in the vehicle | POB |
| `done` | Trip completed successfully | DONE |
| `completed` | Trip marked as complete (legacy) | COMPLETE |
| `cancelled` | Trip was cancelled | CANCEL |
| `no_show` | Passenger did not show up | NO SHOW |

## Status Flow in Driver App

```
assigned → getting_ready → enroute → arrived → waiting → passenger_onboard → done
                                                   ↓
                                               no_show (if countdown expires)
```

## Web UI Legacy Statuses → Canonical Mapping

These legacy statuses from the web UI are mapped to canonical statuses:

| Legacy Status (Web) | → Canonical Status | Notes |
|--------------------|-------------------|-------|
| `driver_en_route` | `enroute` | Old naming convention |
| `on_the_way` | `enroute` | Old naming convention |
| `driver_waiting_at_pickup` | `waiting` | Old naming convention |
| `waiting_at_pickup` | `waiting` | Old naming convention |
| `customer_in_car` | `passenger_onboard` | Old naming convention |
| `driving_passenger` | `passenger_onboard` | Old naming convention |
| `driver_circling` | `arrived` | Driver circling = still at arrival |

## Farmout Status vs Driver Status

The system has **two separate status fields**:

1. **`farmout_status`** - Workflow status for offer/assignment
   - `unassigned`, `offered`, `assigned`, `declined`, `affiliate_assigned`, etc.

2. **`driver_status`** - Trip status set by Driver App
   - `getting_ready`, `enroute`, `arrived`, `waiting`, `passenger_onboard`, `done`, etc.

### When Driver App Updates Status

When a driver changes status in the app, it updates the `driver_status` field in the database:

```javascript
// Driver App writes to:
await supabase
  .from('reservations')
  .update({ driver_status: 'enroute' })
  .eq('id', reservationId);
```

### How Web UI Reads Status

The web UI (UIManager.js) reads from multiple sources:

```javascript
const statusCandidates = [
  reservation?.driver_status,
  reservation?.driverStatus,
  reservation?.trip_status,
  raw?.driver_status,
  // ... etc
];
```

## Status Filter Categories (index-reservations.html)

The status dropdown is now organized into groups:

### Farmout Status
- Unassigned, Offered, Offered to Affiliate, Assigned, Affiliate Assigned, Declined

### Driver Trip Status (from Driver App)
- Getting Ready, En Route, Arrived, Waiting, Passenger Onboard, Complete

### Final Status
- Completed, Cancelled, No Show

### Legacy Status (for old data)
- Driver En Route, Driver On The Way, Driver Waiting at Pickup, Customer In Car, In House

## Files Updated for Status Mapping

1. **DriverApp/src/utils/statusMapping.ts** - Canonical mapping utilities
2. **DriverApp/src/store/useTripStore.ts** - Uses normalizeToAppStatus()
3. **public/UIManager.js** - FARMOUT_STATUS_ALIASES and FARMOUT_STATUS_LABELS
4. **public/shared/UIManager.js** - Same updates (shared version)
5. **public/index-reservations.html** - Updated status dropdown
6. **public/shared/index-reservations.html** - Same updates (shared version)

## Testing Status Synchronization

To verify status sync works:

1. Open Driver App and accept a trip
2. Advance through statuses: En Route → Arrived → Waiting → Customer in Car → Done
3. Verify in Farmout Reservations panel that `driver_status` column shows correct label
4. Filter by each driver trip status to confirm filtering works
