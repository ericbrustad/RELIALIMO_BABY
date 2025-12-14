# RELIA🐂LIMO™ - Netlify & Supabase Setup Guide

## 1. Deploy to Netlify

Your app is already deployed at: **https://relialimo.netlify.app**

## 2. Add Environment Variables to Netlify

Go to your Netlify dashboard:
1. Click **Site settings** → **Build & deploy** → **Environment**
2. Add these environment variables:

```
VITE_SUPABASE_URL=https://siumiadylwcrkaqsfwkj.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpdW1pYWR5bHdjcmthcXNmd2tqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2NjMzMTMsImV4cCI6MjA4MTIzOTMxM30.sSZBsXyOOmIp2eve_SpiUGeIwx3BMoxvY4c7bvE2kKw
```

3. **Trigger a new deploy** (redeploy from Netlify dashboard)

## 3. Configure Supabase CORS & Auth URLs

Go to your **Supabase Dashboard**:

### A. Set Authentication URLs
Settings → Authentication → URL Configuration

**Site URL:**
```
https://relialimo.netlify.app
```

**Redirect URLs:**
```
https://relialimo.netlify.app/auth/callback
https://relialimo.netlify.app
```

### B. Set CORS for Storage (if using file uploads)
Settings → API → CORS Configuration

Add:
```
https://relialimo.netlify.app
```

## 4. Verify Connection

Once deployed, check browser console at https://relialimo.netlify.app:

```javascript
// Paste in browser console to test:
import { testSupabaseConnection } from './supabase-client.js'
await testSupabaseConnection()
// Should log: ✅ Supabase connected successfully
```

Or check the Network tab when your app loads to see:
- ✅ Requests to `siumiadylwcrkaqsfwkj.supabase.co`
- ✅ Status 200 (not 401/403)

## 5. Security Checklist

- ✅ **VITE_SUPABASE_ANON_KEY** exposed in frontend (this is safe if RLS is enabled)
- ✅ **SUPABASE_SERVICE_ROLE_KEY** is NOT in frontend code
- ✅ RLS policies are protecting your data
- ✅ CORS allows only your Netlify domain
- ✅ Emails are lowercased (check constraint added)
- ✅ Confirmation numbers auto-generate (trigger added)

## 6. Files Reference

- **`/env.js`** - Local environment for development
- **`/config.js`** - Imports from window.ENV
- **`/supabase-client.js`** - Ready-to-use Supabase client
- **`/.env.example`** - Template for Netlify environment variables
- **`/supabase-setup.sql`** - Run these SQL commands in Supabase to set up:
  - Performance indexes
  - Email lowercase constraints
  - Auto-generated confirmation numbers
  - Audit field auto-population
  - Enhanced RLS policies

## 7. Apply SQL Setup

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Copy/paste contents of `/supabase-setup.sql`
3. Run the SQL to set up:
   - Indexes for performance
   - Constraints for data integrity
   - Triggers for auto-population
   - Function permissions

## 8. Test RLS & Authorization

Once everything is set up:

```javascript
// Test 1: Check connection
import { testSupabaseConnection } from './supabase-client.js'
await testSupabaseConnection()

// Test 2: Check auth state
import { getCurrentUser } from './supabase-client.js'
const user = await getCurrentUser()
console.log('Current user:', user)

// Test 3: Try to fetch data (RLS should allow/block based on user role)
import { supabase } from './supabase-client.js'
const { data, error } = await supabase
  .from('reservations')
  .select('*')
  .limit(1)
console.log('Reservations:', { data, error })
```

## 9. Common Issues

| Issue | Solution |
|-------|----------|
| `401 Unauthorized` | Check VITE_SUPABASE_ANON_KEY in Netlify environment |
| `CORS error` | Add https://relialimo.netlify.app to Supabase CORS settings |
| `User can't sign in` | Check auth URL configuration in Supabase |
| `Can't fetch data` | Check RLS policies allow your user role |
| `Confirmation numbers not generating` | Run `/supabase-setup.sql` to add trigger |

## 10. Next Steps

1. ✅ Add environment variables to Netlify
2. ✅ Configure Supabase auth URLs and CORS
3. ✅ Run SQL setup to add indexes and triggers
4. ✅ Test connection with browser console
5. ✅ Implement sign-in/sign-out flow
6. ✅ Build out remaining features (Affiliates, Agents, etc.)
