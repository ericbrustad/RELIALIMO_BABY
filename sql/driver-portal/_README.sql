-- ============================================================================
-- DRIVER PORTAL SUBDOMAIN MIGRATION
-- Comprehensive SQL to support driver.relialimo.com/{portal_slug}
-- Run in Supabase SQL Editor in order: 001, 002, 003...
-- ============================================================================

-- This file is a master index. Run each numbered file separately.

/*
==============================================================================
RUN THESE FILES IN ORDER IN SUPABASE SQL EDITOR:
==============================================================================

1. 001_driver_portal_schema.sql
   - Adds portal_slug, profile fields, settings, online status, ratings to drivers table
   - Creates unique index on portal_slug
   - Triggers for updated_at timestamps
   - Emergency contact, notification settings, location tracking fields

2. 002_driver_sessions.sql
   - Creates driver_sessions table for session management
   - Creates driver_login_history table for tracking logins
   - Session tokens, device info, expiration
   - Triggers for last activity updates

3. 003_driver_payment_methods.sql
   - driver_payment_methods: Encrypted storage for Zelle, Venmo, Cash App, bank
   - driver_earnings: Per-trip earnings tracking
   - driver_payouts: Batch payout records
   - Payment verification status

4. 004_driver_availability.sql
   - driver_weekly_schedule: Recurring day-of-week availability
   - driver_availability_exceptions: Date-based overrides (vacation, sick)
   - driver_preferences: Trip type, distance, notification preferences
   - check_driver_availability() function
   - get_available_drivers() function

5. 005_driver_public_profile.sql
   - driver_public_profile: Shareable profile settings
   - driver_testimonials: Reviews/ratings for public display
   - driver_vehicles: Vehicle info for public profile
   - v_driver_public_profiles view

6. 006_driver_portal_rls.sql
   - Row Level Security policies for ALL driver portal tables
   - get_current_driver_id() helper function
   - is_admin_user() helper function
   - Drivers can only access their own data
   - Admins and service_role have full access
   - Public profiles are readable by anyone

7. 007_driver_portal_functions.sql
   - driver_login(email, phone, password, device_info)
   - driver_logout(session_token)
   - validate_driver_session(session_token)
   - generate_portal_slug(first_name, last_name)
   - get_driver_by_portal_slug(portal_slug)
   - get_driver_stats(driver_id)
   - Auto-generate portal_slug trigger on driver insert

8. 008_driver_portal_views.sql
   - v_driver_dashboard: Profile completeness, session count
   - v_driver_upcoming_trips: Today + future reservations
   - v_driver_trip_history: Completed trips with earnings
   - v_driver_earnings_summary: Aggregated by day/week/month/year
   - v_driver_availability_calendar: 60-day calendar with availability
   - v_online_drivers: Currently online with location

==============================================================================
VERIFICATION QUERIES (run after all migrations):
==============================================================================
*/

-- Check all driver-related tables exist:
SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns c WHERE c.table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
AND table_name LIKE 'driver%'
ORDER BY table_name;

-- Check all driver-related views exist:
SELECT table_name as view_name
FROM information_schema.views
WHERE table_schema = 'public' 
AND table_name LIKE 'v_driver%'
ORDER BY table_name;

-- Check RLS is enabled:
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename LIKE 'driver%';

-- Check functions exist:
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name LIKE '%driver%'
ORDER BY routine_name;
