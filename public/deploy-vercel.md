# Vercel Deployment Guide for RELIALIMO

## Prerequisites
- Vercel CLI installed: `npm i -g vercel`
- Twilio account with credentials
- Supabase project with service role key

## Environment Variables (Required)
Set these in Vercel dashboard or via CLI:

```bash
vercel env add SUPABASE_URL
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add TWILIO_ACCOUNT_SID
vercel env add TWILIO_AUTH_TOKEN
vercel env add TWILIO_FROM_NUMBER
```

## Deployment Steps

1. **Login to Vercel**
   ```bash
   vercel login
   ```

2. **Deploy to Vercel**
   ```bash
   vercel --prod
   ```

3. **Set Environment Variables**
   - Go to Vercel dashboard > Project Settings > Environment Variables
   - Add all required variables above
   - Redeploy after adding variables

## Testing Production SMS

1. Open the deployed site
2. Go to `/test-farmout-notification.html`
3. Fill out form with real data
4. Click "Send SMS to Driver" to test to +17632838336
5. Check driver portal at `/driver-portal.html`

## Post-Deployment Checklist

- [ ] SMS endpoint working: `[domain]/api/sms-send`
- [ ] Text messages arriving at +17632838336
- [ ] Driver portal loads and shows notifications
- [ ] Sound notifications working in browser
- [ ] Map displays full-screen on mobile
- [ ] Farmout automation working end-to-end

## Environment Variable Values Needed

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_FROM_NUMBER=+1xxxxxxxxxx
```

## Troubleshooting

- Check Vercel function logs for SMS endpoint errors
- Verify Twilio credentials are correct
- Ensure phone number format is +17632838336
- Check browser console for JavaScript errors