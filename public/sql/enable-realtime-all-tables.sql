-- ============================================
-- SUPABASE SQL: Enable Real-Time for All Tables
-- Run this in Supabase SQL Editor
-- ============================================

-- Enable realtime for core tables
ALTER PUBLICATION supabase_realtime ADD TABLE reservations;
ALTER PUBLICATION supabase_realtime ADD TABLE drivers;
ALTER PUBLICATION supabase_realtime ADD TABLE accounts;
ALTER PUBLICATION supabase_realtime ADD TABLE vehicle_types;
ALTER PUBLICATION supabase_realtime ADD TABLE portal_settings;
ALTER PUBLICATION supabase_realtime ADD TABLE customer_booking_defaults;

-- ============================================
-- VERIFICATION
-- ============================================

-- Check which tables have realtime enabled
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';

-- ============================================
-- NOTES
-- ============================================
-- 
-- After running this SQL, the following will happen:
-- 
-- 1. When a reservation is created/updated/deleted in admin portal:
--    - Driver portal will see the change immediately
--    - Customer portal will see the change immediately
--
-- 2. When a driver updates their status/location:
--    - Admin portal dispatch grid will update
--    - Customer portal can show driver location
--
-- 3. When portal settings are changed:
--    - All portals will refresh their branding/settings
--
-- 4. When vehicle types are updated:
--    - All portals will show updated vehicle options
--
-- Usage in JavaScript:
-- 
-- import realtimeService from './shared/realtime-service.js';
-- 
-- // Subscribe to all reservation changes
-- realtimeService.subscribeToReservations((eventType, newData, oldData) => {
--   if (eventType === 'INSERT') {
--     console.log('New reservation:', newData);
--   } else if (eventType === 'UPDATE') {
--     console.log('Reservation updated:', newData);
--   } else if (eventType === 'DELETE') {
--     console.log('Reservation deleted:', oldData);
--   }
-- });
--
-- // Subscribe to driver changes
-- realtimeService.subscribeToDrivers((eventType, newData, oldData) => {
--   console.log('Driver changed:', eventType, newData);
-- });
