-- Create passenger_notifications table for real-time trip notifications
-- This table stores notifications sent from drivers to passengers during trips

CREATE TABLE IF NOT EXISTS passenger_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id BIGINT REFERENCES reservations(id) ON DELETE CASCADE,
    account_id BIGINT REFERENCES accounts(id) ON DELETE CASCADE,
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

-- Policy: Authenticated users can view their own notifications
CREATE POLICY "Users can view their own notifications"
    ON passenger_notifications FOR SELECT
    USING (
        -- Match by account_id if user is associated with an account
        account_id IN (
            SELECT id FROM accounts 
            WHERE email = auth.email()
        )
        OR
        -- Or match by passenger email
        passenger_email = auth.email()
    );

-- Policy: Service role can insert notifications (from driver portal)
CREATE POLICY "Service role can insert notifications"
    ON passenger_notifications FOR INSERT
    WITH CHECK (true);

-- Policy: Users can mark their notifications as read
CREATE POLICY "Users can mark notifications as read"
    ON passenger_notifications FOR UPDATE
    USING (
        account_id IN (
            SELECT id FROM accounts 
            WHERE email = auth.email()
        )
        OR passenger_email = auth.email()
    )
    WITH CHECK (
        account_id IN (
            SELECT id FROM accounts 
            WHERE email = auth.email()
        )
        OR passenger_email = auth.email()
    );

-- Enable realtime for this table so customer portal gets live updates
ALTER PUBLICATION supabase_realtime ADD TABLE passenger_notifications;

-- Add comment
COMMENT ON TABLE passenger_notifications IS 'Real-time notifications sent from drivers to passengers during trips';
