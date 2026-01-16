# Rate Scheme Management System

## Overview

The Rate Scheme Management System allows you to save rate configurations as reusable templates and apply them across different vehicle types. This is useful for:

- Standardizing rates across your fleet
- Quickly setting up new vehicle types with predefined rates
- Maintaining consistent pricing strategies

## Database Setup

Before using the rate scheme features, you need to run the SQL migration to create the necessary functions.

### Required Tables (already exist)

- `vehicle_type_rate_matrices` - Rate matrices associated with vehicle types
- `vehicle_type_rate_entries` - Individual rate entries (tiers) within a matrix
- `saved_rate_schemes` - Saved rate scheme templates
- `saved_rate_scheme_entries` - Entries within saved schemes
- `v_saved_rate_schemes` - View for querying saved schemes with metadata

### Required Functions (run the migration)

Run the following SQL in your Supabase SQL Editor:

```sql
-- See scripts/sql/rate_scheme_functions.sql
```

The functions are:

1. **`save_vehicle_rate_scheme(p_vehicle_type_id, p_rate_type, p_scheme_name, p_created_by)`**
   - Saves the current rate matrix entries for a vehicle type as a reusable named scheme
   - Returns the new scheme ID

2. **`apply_saved_rate_scheme_to_vehicle(p_target_vehicle_type_id, p_scheme_id, p_make_default, p_matrix_name, p_matrix_description, p_user_id)`**
   - Applies a saved rate scheme to a target vehicle type
   - Creates or replaces the rate matrix with entries from the scheme
   - Returns the new matrix ID

## User Guide

### Saving a Rate Scheme

1. Go to **My Office → Company Resources → Vehicle Types**
2. Select a vehicle type from the list
3. Click **Edit Vehicle Type** to unlock the tabs
4. Navigate to the **Rates** tab
5. Configure the rates as desired (Per Hour, Per Passenger, or Distance Based)
6. Click **💾 Save as Rate Scheme**
7. Enter a name for the scheme (e.g., "Standard Sedan Rate")
8. Select the rate type (Per Hour, Per Passenger, or Distance)
9. Click **Save Rate Scheme**

### Applying a Saved Rate Scheme

1. Go to **My Office → Company Resources → Vehicle Types**
2. Select the target vehicle type
3. Click **Edit Vehicle Type** to unlock the tabs
4. Navigate to the **Rates** tab
5. Click **📥 Apply Saved Rate**
6. Filter by rate type if needed
7. Select a scheme from the list
8. Optionally check "Set as default rate matrix"
9. Click **Apply Rate Scheme**

## Rate Types

### Per Hour Rates (`PER_HOUR`)
- Rate per Hour
- Minimum Hours
- Base Rate / Flat Fee
- Overtime Rate
- Gratuity %
- Wait Time Rate

### Per Passenger Rates (`PER_PASSENGER`)
- Rate per Passenger
- Minimum Passengers
- Maximum Passengers
- Base Fare
- Gratuity %
- Extra Passenger Rate

### Distance Based Rates (`DISTANCE`)
- Rate per Mile
- Minimum Fare
- Included Miles
- Base Fare
- Gratuity %
- Dead Mile Rate

## Technical Notes

### Rate Storage Formats

Rates are stored in two formats:

1. **JSON format** (in `vehicle_types.rates` column):
   ```json
   {
     "perHour": {
       "ratePerHour": 75.00,
       "minimumHours": 3,
       "baseRate": 50.00,
       "overtimeRate": 100.00,
       "gratuity": 20,
       "waitTimeRate": 45.00
     },
     "perPassenger": { ... },
     "distance": { ... }
   }
   ```

2. **Rate Matrix format** (in separate tables):
   - Each rate type has its own matrix record
   - Entries are stored with `from_quantity`, `to_quantity`, `rate`, and `unit`

### Fallback Behavior

If the RPC functions are not available (404 error), the system falls back to:
- Direct table inserts for saving schemes
- Converting between JSON and entry formats

### API Endpoints

- `POST /rpc/save_vehicle_rate_scheme` - Save a rate scheme
- `POST /rpc/apply_saved_rate_scheme_to_vehicle` - Apply a scheme
- `GET /saved_rate_schemes` - List all saved schemes
- `GET /v_saved_rate_schemes` - List schemes with metadata
- `GET /saved_rate_scheme_entries?scheme_id=eq.{id}` - Get entries for a scheme

## Troubleshooting

### "RPC not found" Error
Run the SQL migration in `scripts/sql/rate_scheme_functions.sql` to create the functions.

### "No saved rate schemes found"
Either no schemes have been saved yet, or there's an issue connecting to Supabase. Check the browser console for errors.

### Rate values not updating
Make sure to click one of the Save buttons (SAVE HOURLY RATES, SAVE PASSENGER RATES, or SAVE DISTANCE RATES) before saving a scheme.
