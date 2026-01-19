# Database Setup Guide - Drivers, Affiliates, Vehicle Types, Fleet

This guide ensures all fields in the RELIALIMO application are properly saved to the Supabase database.

## Quick Start

1. **Run the SQL migration** in Supabase SQL Editor:
   - Open your Supabase project dashboard
   - Go to SQL Editor
   - Copy and run the contents of `sql/sync_all_fields.sql`

2. **Enable database on localhost** (already configured in env.js):
   ```javascript
   FORCE_DATABASE_ON_LOCALHOST: true
   ```

## Database Tables

### 1. `drivers` Table
Stores all driver information.

**Key columns:**
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `organization_id` | UUID | Organization reference |
| `first_name` | TEXT | First name (required) |
| `last_name` | TEXT | Last name (required) |
| `status` | TEXT | Employment status: 'ACTIVE' or 'INACTIVE' |
| `is_active` | BOOLEAN | Convenience boolean (synced with status) |
| `driver_status` | TEXT | Availability: 'available', 'enroute', 'arrived', etc. |
| `cell_phone` | TEXT | Cell phone (required) |
| `email` | TEXT | Email address (required) |
| `assigned_vehicle_id` | UUID | Reference to vehicles table |
| `affiliate_id` | UUID | Reference to affiliates table |
| `affiliate_name` | TEXT | Cached affiliate name |

### 2. `affiliates` Table
Stores affiliate company information.

**Key columns:**
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `organization_id` | UUID | Organization reference |
| `company_name` | TEXT | Company name |
| `status` | TEXT | 'ACTIVE' or 'INACTIVE' |
| `is_active` | BOOLEAN | Convenience boolean |
| `associated_driver_ids` | UUID[] | Array of linked driver IDs |
| `associated_vehicle_type_ids` | UUID[] | Array of vehicle types this affiliate can service |

### 3. `vehicle_types` Table
Stores vehicle type definitions.

**Key columns:**
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `organization_id` | UUID | Organization reference |
| `name` | TEXT | Vehicle type name (required) |
| `status` | TEXT | 'ACTIVE' or 'INACTIVE' |
| `active` | BOOLEAN | Convenience boolean |
| `service_type` | TEXT | Legacy single service type |
| `service_type_tags` | TEXT[] | Array of service types |
| `rates` | JSONB | Rate matrix data |
| `passenger_capacity` | INTEGER | Passenger capacity |
| `luggage_capacity` | INTEGER | Luggage capacity |
**Important:** The application now requires the client to READ and WRITE directly against the base table `public.vehicle_types`. Do not rely on a `vehicle_types_public` view for reads/writes.

If you need to allow authenticated browser sessions to create/update/delete rows, apply the RLS policies in `scripts/sql/vehicle_types_rls.sql` (run in Supabase SQL editor as a privileged user). After applying RLS, verify write access with:

```bash
# Run from project root (reads env from server/.env or .env)
npm run test:vehicle-types
```

If you see permission errors (401/403/403 Forbidden), inspect your RLS policies and ensure the current user exists in `organization_members` or adjust the policy to use JWT claims for `organization_id`.

### 4. `vehicles` Table (Fleet)
Stores individual vehicle/fleet information.

**Key columns:**
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `organization_id` | UUID | Organization reference |
| `vehicle_type_id` | UUID | Reference to vehicle_types |
| `vehicle_type` | TEXT | Vehicle type name (cached) |
| `veh_type` | TEXT | Alternative vehicle type name field |
| `veh_disp_name` | TEXT | Display name (Year Make Model) |
| `status` | TEXT | Vehicle status |
| `is_active` | BOOLEAN | Convenience boolean |
| `make` | TEXT | Vehicle make |
| `model` | TEXT | Vehicle model |
| `year` | INTEGER | Vehicle year |
| `assigned_driver_id` | UUID | Reference to drivers |
| `features` | TEXT[] | Array of features/amenities |

## Troubleshooting

### Data Not Saving

1. **Check browser console** for errors:
   - Open DevTools (F12)
   - Look for red error messages
   - Common errors: "column X does not exist"

2. **Run the sync SQL migration**:
   ```sql
   -- Copy contents of sql/sync_all_fields.sql and run in Supabase
   ```

3. **Verify FORCE_DATABASE_ON_LOCALHOST**:
   - Check `env.js` has `FORCE_DATABASE_ON_LOCALHOST: true`
   - This ensures localhost uses Supabase instead of localStorage

### Column Does Not Exist Errors

If you see errors like `"column is_active does not exist"`:

1. Run the migration script: `sql/sync_all_fields.sql`
2. This adds all missing columns to all tables

### Data Saving to localStorage Instead of Database

This happens when running on localhost without the force flag:

1. Edit `env.js`:
   ```javascript
   FORCE_DATABASE_ON_LOCALHOST: true
   ```

2. Refresh the page

### Authentication Errors

If saves fail with 401/403 errors:

1. Check you're logged in
2. Try logging out and back in
3. Verify RLS policies are configured correctly

## SQL Migration Files

Located in `sql/` directory:

| File | Purpose |
|------|---------|
| `sync_all_fields.sql` | **Main sync file** - run this to add all missing columns |
| `add_driver_fields.sql` | Driver table schema |
| `add_affiliate_fields.sql` | Affiliate table schema |
| `add_vehicle_tables.sql` | Vehicle types and vehicles schema |
| `add_driver_affiliate_vehicle_type.sql` | Relationship columns |

## API Functions

Located in `api-service.js`:

### Drivers
- `createDriver(driverData)` - Create new driver
- `updateDriver(driverId, driverData)` - Update existing driver
- `deleteDriver(driverId)` - Delete driver
- `fetchDrivers()` - List all drivers

### Affiliates
- `createAffiliate(data)` - Create new affiliate
- `updateAffiliate(id, data)` - Update existing affiliate
- `deleteAffiliate(id)` - Delete affiliate
- `fetchAffiliates()` - List all affiliates

### Vehicle Types
- `upsertVehicleType(data)` - Create or update vehicle type
- `deleteVehicleType(id)` - Delete vehicle type
- `fetchVehicleTypes(options)` - List vehicle types

### Vehicles (Fleet)
- `createVehicle(data)` - Create new vehicle
- `updateVehicle(id, data)` - Update existing vehicle
- `deleteVehicle(id)` - Delete vehicle
- `fetchActiveVehicles(options)` - List vehicles

## Data Flow

```
User Interface (my-office.html)
         ↓
JavaScript Handler (my-office.js)
         ↓
API Service (api-service.js)
         ↓
Supabase REST API
         ↓
PostgreSQL Database
```

## Development vs Production

### Development (localhost)
- Set `FORCE_DATABASE_ON_LOCALHOST: true` in `env.js`
- Data goes to Supabase (recommended)
- Or set to `false` for localStorage-only mode

### Production
- Always uses Supabase
- Requires valid authentication
- RLS policies must be configured
