-- Create passenger_notifications table for real-time trip notifications
-- This table stores notifications sent from drivers to passengers during trips

CREATE TABLE IF NOT EXISTS passenger_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id UUID REFERENCES reservations(id) ON DELETE CASCADE,
    account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL, -- 'on_the_way', 'arrived', 'trip_complete'
    title VARCHAR(255) NOT NULL,
    message TEXT,
    passenger_email VARCHAR(255),
    passenger_phone VARCHAR(50),
    confirmation_number VARCHAR(50),
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_passenger_notifications_reservation 
    ON passenger_notifications(reservation_id);
CREATE INDEX IF NOT EXISTS idx_passenger_notifications_account 
    ON passenger_notifications(account_id);
CREATE INDEX IF NOT EXISTS idx_passenger_notifications_confirmation 
    ON passenger_notifications(confirmation_number);
CREATE INDEX IF NOT EXISTS idx_passenger_notifications_created 
    ON passenger_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_passenger_notifications_unread 
    ON passenger_notifications(account_id, read) WHERE read = FALSE;

-- Enable Row Level Security
ALTER TABLE passenger_notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own notifications" ON passenger_notifications;
DROP POLICY IF EXISTS "Service role can insert notifications" ON passenger_notifications;
DROP POLICY IF EXISTS "Users can mark notifications as read" ON passenger_notifications;
DROP POLICY IF EXISTS "Allow all operations on passenger_notifications" ON passenger_notifications;

-- Create permissive policy for all operations (matching your other tables)
CREATE POLICY "Allow all operations on passenger_notifications"
    ON passenger_notifications FOR ALL
    USING (true)
    WITH CHECK (true);

-- ============================================
-- ENABLE REALTIME
-- ============================================
-- First, check if realtime is already enabled and add if not
DO $$
BEGIN
    -- Try to add table to realtime publication
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'passenger_notifications'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE passenger_notifications;
        RAISE NOTICE 'Added passenger_notifications to supabase_realtime publication';
    ELSE
        RAISE NOTICE 'passenger_notifications already in supabase_realtime publication';
    END IF;
EXCEPTION
    WHEN undefined_object THEN
        -- Publication doesn't exist, create it
        CREATE PUBLICATION supabase_realtime FOR TABLE passenger_notifications;
        RAISE NOTICE 'Created supabase_realtime publication with passenger_notifications';
END $$;

-- Enable replica identity for realtime (required for UPDATE/DELETE events)
ALTER TABLE passenger_notifications REPLICA IDENTITY FULL;

-- Add comment
COMMENT ON TABLE passenger_notifications IS 'Real-time notifications sent from drivers to passengers during trips';
