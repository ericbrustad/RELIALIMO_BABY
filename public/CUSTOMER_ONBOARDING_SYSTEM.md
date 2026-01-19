# Customer Account Onboarding System

## Overview

This system provides a complete customer account onboarding flow with:
- **Email Verification** with secure roundtrip links
- **Multi-step Onboarding** wizard
- **Google Places** address autocomplete
- **Nearby Airport** detection and selection
- **International Phone Input** validation
- **Payment Method** collection (optional)
- **Driver/Map Display** showing nearby drivers

## URL Structure

Customer accounts are accessed at:
```
https://account.relialimo.com/First_Name_Last_Name
```

## Flow Diagram

```
1. Customer Registration (auth.html)
         ↓
2. Verification Email Sent
         ↓
3. Customer clicks email link
         ↓
4. Email Verified (customer-onboarding.html?token=xxx)
         ↓
5. Onboarding Wizard:
   - Step 1: Home Address + Airport Selection
   - Step 2: Cell Phone Number
   - Step 3: Payment Method (Yes/No)
         ↓
6. Account Complete → Portal Access
```

## Files Created/Modified

### New Files

| File | Description |
|------|-------------|
| `customers/customer-onboarding.html` | Onboarding wizard HTML |
| `customers/customer-onboarding.js` | Onboarding JavaScript logic |
| `customers/customer-onboarding.css` | Onboarding styles |
| `customers/customer-email-verification.js` | Email verification service |
| `app/api/send-email/route.ts` | Next.js API endpoint for sending emails |
| `sql/customer-email-verification-schema.sql` | Database schema for verifications |

### Modified Files

| File | Changes |
|------|---------|
| `middleware.ts` | Added routes for `/verify`, `/onboarding`, `/auth` |
| `customers/auth.html` | Updated registration to send verification emails |

## Database Schema

### New Table: `customer_email_verifications`

```sql
CREATE TABLE customer_email_verifications (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  user_data JSONB,
  verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### New Columns on `accounts` Table

| Column | Type | Description |
|--------|------|-------------|
| `email_verified` | BOOLEAN | Email verification status |
| `email_verified_at` | TIMESTAMPTZ | When email was verified |
| `onboarding_complete` | BOOLEAN | Onboarding completion status |
| `onboarding_completed_at` | TIMESTAMPTZ | When onboarding completed |
| `home_airport` | TEXT | Preferred airport code (e.g., "MSP") |
| `home_airport_name` | TEXT | Full airport name |
| `home_coordinates` | JSONB | Lat/lng of home address |
| `has_payment_method` | BOOLEAN | Payment method on file |
| `payment_method_last4` | TEXT | Last 4 digits of card |
| `payment_method_type` | TEXT | Card type (visa, mastercard, etc.) |

## Setup Instructions

### 1. Run Database Migration

Execute the SQL in Supabase SQL Editor:
```bash
# Copy contents of sql/customer-email-verification-schema.sql
```

### 2. Configure Email Service

Add to your Vercel environment variables:
```env
RESEND_API_KEY=re_xxxxxxxxx
EMAIL_FROM=RELIALIMO <noreply@relialimo.com>
```

### 3. Deploy

```bash
vercel --prod
```

## API Endpoints

### POST `/api/send-email`

Sends transactional emails via Resend.

**Request:**
```json
{
  "to": "customer@email.com",
  "subject": "Welcome to RELIALIMO",
  "html": "<html>...</html>",
  "text": "Plain text version (optional)"
}
```

**Response:**
```json
{
  "success": true,
  "messageId": "xxx"
}
```

## Onboarding Steps Detail

### Step 1: Home Address
- Google Places Autocomplete for address entry
- Parses address into components (street, city, state, zip)
- Stores coordinates for map display
- Finds airports within 100 miles using Haversine formula
- Suggests top 5 nearest airports

### Step 2: Phone Number
- Uses intl-tel-input library for international format
- Validates phone number in real-time
- Stores in E.164 format (e.g., +17635551234)

### Step 3: Payment Method
- Optional - customer can skip
- Collects card name, number, expiry, CVV
- Detects card type (Visa, Mastercard, Amex, Discover)
- Stores last 4 digits and type only (actual payment via Stripe in production)

### Completion Screen
- Shows account summary
- Displays Mapbox map with home location
- Shows mock nearby drivers
- "Start Booking Rides" button redirects to portal

## Verification Email Template

The verification email includes:
- RELIALIMO branding
- Welcome message with first name
- Large "Verify My Email" button
- Fallback text link
- 24-hour expiration notice
- Future portal URL preview

## URL Routes

| Route | Rewrites To |
|-------|-------------|
| `account.relialimo.com/` | Customer portal |
| `account.relialimo.com/verify?token=xxx` | Onboarding (verification) |
| `account.relialimo.com/onboarding` | Onboarding page |
| `account.relialimo.com/auth` | Login/Register page |
| `account.relialimo.com/First_Name_Last_Name` | Customer portal with slug |

## Testing

### Local Development

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Register a new account at:
   ```
   http://localhost:3000/customers/auth.html
   ```

3. Check the browser console for the verification URL if email sending fails.

4. Visit the verification URL to test the onboarding flow.

### Verification Token (Development)

If email sending is not configured, the verification URL is logged to the console:
```
📧 Verification URL (for testing): https://account.relialimo.com/verify?token=xxx&email=xxx&redirect=xxx
```

## Security Considerations

1. **Token Security**: Verification tokens are 64-character hex strings (256 bits of entropy)
2. **Token Expiry**: Tokens expire after 24 hours
3. **One-time Use**: Tokens are marked as verified after use
4. **RLS Enabled**: Row Level Security protects the verifications table

## Dependencies

- **Google Maps API**: Address autocomplete
- **Mapbox**: Map display with drivers
- **intl-tel-input**: International phone input
- **Resend**: Email delivery

## Future Enhancements

1. Integrate Stripe for real payment processing
2. Add SMS verification for phone numbers
3. Implement email change verification
4. Add "Remember this device" for MFA
5. Support for business accounts with multiple users
