# Driver Portal Architecture

## Overview
This document describes the architecture for the RELIALIMO Driver Portal - a mobile-friendly web application that allows drivers to:
1. Register and create their driver account
2. Add their company/affiliate information
3. Add their vehicle details
4. View and manage assigned trips
5. Update trip status in real-time

---

## Database Schema Summary

### Core Tables

#### `drivers` Table
- **Primary Key**: `id` (UUID)
- **Organization Link**: `organization_id` → `organizations.id`
- **Affiliate Link**: `affiliate_id` → `affiliates.id`
- **Key Fields**:
  - `first_name`, `last_name`, `email`, `cell_phone`
  - `primary_address`, `city`, `state`, `postal_code`
  - `license_number`, `license_state`, `license_exp_date`
  - `tlc_license_number`, `tlc_license_exp_date`
  - `status`: `'ACTIVE'` | `'INACTIVE'`
  - `type`: `'FULL TIME'` | `'PART TIME'`
  - `driver_status`: `'available'` | `'enroute'` | `'arrived'` | `'passenger_onboard'` | `'busy'` | `'offline'`
  - `is_active`: Boolean (mirrors status)
  - `affiliate_name`: Cached affiliate company name
  - `web_access`: `'ALLOW'` | `'DENY'`
  - `web_username`, `web_password`
  - `assigned_vehicle_id` → `vehicles.id`

#### `affiliates` Table
- **Primary Key**: `id` (UUID)
- **Organization Link**: `organization_id` → `organizations.id`
- **Key Fields**:
  - `company_name`, `primary_address`, `city`, `state`, `zip`
  - `phone`, `email`, `fax`
  - `first_name`, `last_name` (primary contact)
  - `status`: `'ACTIVE'` | `'INACTIVE'`
  - `associated_driver_ids`: UUID[] (array of linked drivers)
  - `associated_vehicle_type_ids`: UUID[] (vehicle types they service)
  - `send_trip_email`, `send_trip_sms`, `send_trip_fax`: Boolean

#### `vehicles` Table
- **Primary Key**: `id` (UUID)
- **Organization Link**: `organization_id` → `organizations.id`
- **Key Fields**:
  - `make`, `model`, `year`, `color`
  - `license_plate`, `vin`
  - `vehicle_type` → references vehicle type name
  - `vehicle_type_id` → `vehicle_types.id`
  - `capacity` (passenger count)
  - `status`: `'AVAILABLE'` | `'IN_USE'` | `'MAINTENANCE'` | `'RETIRED'`

#### `vehicle_types` Table
- **Primary Key**: `id` (UUID)
- **Key Fields**:
  - `name`, `code`
  - `passenger_capacity`, `luggage_capacity`
  - `status`: `'ACTIVE'` | `'INACTIVE'`
  - `pricing_basis`, `color_hex`

#### `reservations` Table
- **Primary Key**: `id` (UUID)
- **Key Fields**:
  - `confirmation_number` (unique)
  - `status`: `'pending'` | `'confirmed'` | `'in_progress'` | `'completed'` | `'cancelled'`
  - `pickup_address`, `pickup_city`, `pickup_state`, `pickup_datetime`
  - `dropoff_address`, `dropoff_city`, `dropoff_state`, `dropoff_datetime`
  - `passenger_count`, `special_instructions`
  - `account_id` → billing account

#### `reservation_assignments` Table
- Links drivers to reservations
- **Key Fields**:
  - `reservation_id` → `reservations.id`
  - `assigned_driver_user_id` → `auth.users.id`
  - `vehicle_id` → `vehicles.id`
  - `status`: `'assigned'` | `'accepted'` | `'in_progress'` | `'completed'` | `'cancelled'`
  - `assigned_at`, `accepted_at`, `completed_at`

---

## Driver Status Workflow

### Driver Availability Statuses
```
available → enroute → arrived → passenger_onboard → available
              ↓
           circling (optional)
```

### Trip Status Workflow
```
1. Trip Offered → Driver accepts
2. assigned → Driver starts trip
3. enroute (On the Way) → Sends "On the Way" notification
4. arrived → Sends "Arrived" notification
5. passenger_onboard → Passenger picked up
6. completed → Trip finished, enter incidentals
```

### Notification Triggers
| Status Change | Action |
|---------------|--------|
| `enroute` | Send "Driver On The Way" SMS/Email to passenger |
| `arrived` | Send "Driver Arrived" SMS/Email to passenger |
| `passenger_onboard` | Log event, update ETA |
| `completed` | Final trip log, billing triggers |

---

## API Functions (from api-service.js)

### Driver Operations
```javascript
fetchDrivers(options)          // Get all drivers
createDriver(driverData)       // Create new driver
updateDriver(driverId, data)   // Update driver
deleteDriver(driverId)         // Delete driver
```

### Affiliate Operations
```javascript
fetchAffiliates()              // Get all affiliates
createAffiliate(affiliateData) // Create new affiliate
updateAffiliate(id, data)      // Update affiliate
deleteAffiliate(id)            // Delete affiliate
```

### Vehicle Operations
```javascript
fetchActiveVehicles(options)   // Get vehicles
// Vehicle upsert handled via form popup
```

### Vehicle Type Operations
```javascript
fetchVehicleTypes(options)     // Get vehicle types
upsertVehicleType(data)        // Create/update vehicle type
```

---

## Driver Portal Features

### 1. Driver Registration (Onboarding)
**Step 1: Basic Info**
- First Name, Last Name (required)
- Email (required, unique per org)
- Cell Phone (required)
- Password setup

**Step 2: Company/Affiliate Info**
- Company Name (optional - creates affiliate)
- Company Address, City, State, Zip
- Company Phone, Email

**Step 3: Vehicle Info**
- Vehicle Type (dropdown from active types)
- Make, Model, Year
- License Plate (required)
- Passenger Capacity

### 2. Trip Dashboard Tabs

#### Tab: Offered Trips
- Shows trips where driver is selected/offered but not yet accepted
- Display: Date/Time, Conf#, Passenger, PU → DO
- Actions: Accept, Decline

#### Tab: Upcoming Trips
- Shows accepted trips scheduled for the future
- Display: Date/Time, Conf#, Passenger, PU → DO
- Actions: Start Trip

#### Tab: In Progress
- Shows active trip (only one at a time)
- Status buttons based on current state
- Large, touch-friendly controls

### 3. Trip Status Actions

| Current Status | Available Actions |
|----------------|-------------------|
| assigned | Start Trip (→ enroute) |
| enroute | Arrived, Circling |
| arrived | Passenger On Board |
| circling | Arrived |
| passenger_onboard | Complete Trip |
| completed | Enter Incidentals → Finish |

### 4. Post-Trip Form
After "Complete Trip":
- Wait Time (minutes)
- Extra Stops (count)
- Tolls/Parking ($)
- Tips ($)
- Driver Notes

---

## File Structure

```
/driver-portal/
├── driver-portal.html      # Main SPA page
├── driver-portal.css       # Mobile-first styles
├── driver-portal.js        # Portal logic
└── driver-register.html    # Registration wizard (optional separate page)
```

---

## localStorage Keys

| Key | Purpose |
|-----|---------|
| `driver_portal_session` | Driver's auth token |
| `driver_portal_id` | Current driver UUID |
| `driver_portal_org_id` | Organization UUID |
| `relia_driver_status_overrides` | Local status cache |
| `relia_farmout_assignments` | Trip assignments cache |

---

## Security Considerations

1. **Row Level Security (RLS)**: Drivers can only see their own data
2. **Auth**: Use Supabase auth with magic link or password
3. **org_id**: All queries must include organization_id filter
4. **Rate Limiting**: Implement on status updates to prevent spam

---

## Mobile UX Guidelines

1. **Touch Targets**: Minimum 44x44px for all buttons
2. **Font Size**: Minimum 16px for inputs (prevents zoom on iOS)
3. **Swipe Actions**: Optional swipe to accept/decline trips
4. **Offline Support**: Cache current trip for offline status updates
5. **PWA Ready**: Add manifest.json for "Add to Home Screen"

---

## Notification Integration

### SMS (Twilio/Provider)
```javascript
// Triggered when driver status changes
async function sendStatusNotification(tripId, status) {
  const trip = await getTrip(tripId);
  const account = await getAccount(trip.account_id);
  
  if (account.send_trip_sms && account.phone) {
    await sendSMS(account.phone, `Your driver is ${status}`);
  }
  
  if (account.send_trip_email && account.email) {
    await sendEmail(account.email, 'Trip Update', template);
  }
}
```

---

## Quick Reference: Status Emojis

| Status | Emoji | Color |
|--------|-------|-------|
| available | 🟢 | Green |
| enroute | 🟡 | Yellow |
| arrived | 🟠 | Orange |
| passenger_onboard | 🔵 | Blue |
| completed | ✅ | Green |
| busy | 🔴 | Red |
| offline | ⚫ | Gray |
