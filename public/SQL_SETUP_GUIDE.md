# RELIA🐂LIMO™ - SQL Setup Guide

## Setup Order (IMPORTANT!)

Run these SQL files in this exact order in your Supabase SQL Editor:

### Step 1: Create Database Schema
**File:** `/supabase-schema.sql`

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Click **"New Query"**
3. Copy the entire contents of `/supabase-schema.sql`
4. Paste into the SQL editor
5. Click **"Run"** button (▶️)
6. Wait for completion (should see "Schema created successfully!")

**This creates:**
- ✅ Organizations
- ✅ Organization Members
- ✅ Accounts (Customers)
- ✅ Account Emails
- ✅ Drivers
- ✅ Vehicles
- ✅ Reservations
- ✅ Reservation Route Stops
- ✅ Reservation Assignments
- ✅ Reservation Events
- ✅ Helper functions
- ✅ Basic RLS policies

---

### Step 2: Add Performance Improvements
**File:** `/supabase-setup.sql`

1. Click **"New Query"** again
2. Copy the entire contents of `/supabase-setup.sql`
3. Paste into the SQL editor
4. Click **"Run"**
5. Wait for completion

**This adds:**
- ✅ Performance indexes
- ✅ Email lowercase constraints
- ✅ Auto-generated confirmation numbers
- ✅ Audit field auto-population (created_by, updated_by)
- ✅ Enhanced RLS policies for drivers/customers
- ✅ Function permissions

---

## What Each File Does

### `/supabase-schema.sql` (MUST RUN FIRST)
- Creates all 10 tables with proper relationships
- Adds basic RLS policies
- Creates `get_user_role_in_org()` helper function
- Sets up data validation

### `/supabase-setup.sql` (RUN SECOND)
- Adds database indexes for performance
- Adds check constraints for email lowercase
- Adds confirmation number auto-generation trigger
- Adds audit field auto-population triggers
- Enhances RLS policies
- Grants function permissions

---

## Verification

After running both SQL files, verify everything is set up:

### Check Tables Exist
Run this query in Supabase SQL Editor:

```sql
select table_name from information_schema.tables 
where table_schema = 'public' 
order by table_name;
```

Should show:
- account_emails
- accounts
- drivers
- organization_members
- organizations
- reservation_assignments
- reservation_events
- reservation_route_stops
- reservations
- vehicles

### Check Indexes Exist
Run this query:

```sql
select schemaname, tablename, indexname
from pg_indexes 
where schemaname = 'public' 
order by tablename, indexname;
```

Should show indexes like:
- `idx_res_assignments_res_driver`
- `idx_reservations_booked_by`
- `idx_reservations_org_id`
- `idx_reservation_events_reservation_id`

### Check RLS is Enabled
Run this query:

```sql
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;
```

All should have `rowsecurity = true`

---

## Troubleshooting

### Error: "relation does not exist"
**Solution:** Make sure you ran `/supabase-schema.sql` FIRST before `/supabase-setup.sql`

### Error: "permission denied"
**Solution:** Make sure you're logged into Supabase with the right account that owns the project

### Error: "constraint already exists"
**Solution:** This is OK! The `if not exists` clauses prevent re-creation

### Error in the middle of a script
**Solution:** 
1. Check the error message carefully
2. Fix the issue (usually a missing extension)
3. Run the rest of the script from where it failed

---

## Next Steps

1. ✅ Run `/supabase-schema.sql`
2. ✅ Run `/supabase-setup.sql`
3. ✅ Verify tables and indexes
4. ✅ Add Netlify environment variables
5. ✅ Configure Supabase auth URLs
6. ✅ Test API connection

---

## Test Data (Optional)

To test RLS policies, you can insert test data:

```sql
-- Create an organization
insert into public.organizations (name, timezone, currency)
values ('Test Company', 'America/Chicago', 'USD')
returning id;

-- Copy that ID and use it below...

-- Add yourself as admin
insert into public.organization_members (organization_id, user_id, role)
values ('YOUR-ORG-ID-HERE', auth.uid(), 'admin');

-- Create a test customer
insert into public.accounts (organization_id, email, first_name, last_name)
values ('YOUR-ORG-ID-HERE', 'customer@example.com', 'John', 'Doe');

-- Create a test driver
insert into public.drivers (organization_id, first_name, last_name, email)
values ('YOUR-ORG-ID-HERE', 'Jane', 'Driver', 'driver@example.com');

-- Create a test reservation
insert into public.reservations 
(organization_id, confirmation_number, booked_by_user_id, status, pickup_address, dropoff_address)
values ('YOUR-ORG-ID-HERE', 'R0000001', auth.uid(), 'confirmed', '123 Main St', '456 Oak Ave')
returning confirmation_number, id;
```

---

## Files Summary

| File | Purpose | When to Run |
|------|---------|-----------|
| `/supabase-schema.sql` | Create tables & basic RLS | **First** |
| `/supabase-setup.sql` | Add indexes & triggers | **Second** |
| `/env.js` | Local dev environment | Development |
| `/config.js` | Imports from window.ENV | Development |
| `/supabase-client.js` | Frontend Supabase client | Your app |
| `/.env.example` | Netlify env template | Netlify setup |

---

## Support

If you encounter issues:
1. Check the error message carefully
2. Verify you ran SQL files in the correct order
3. Check Supabase Dashboard for table/policy status
4. Review RLS policies in Supabase Authentication → Policies
