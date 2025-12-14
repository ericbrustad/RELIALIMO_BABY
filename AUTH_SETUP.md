# RELIA🐂LIMO™ - Authentication Setup Guide (Login Removed)

## Overview
This environment now uses Supabase email/password authentication with optional magic links. The login page (`/auth.html`) talks directly to Supabase using your public project URL and anon key.

## Supabase Configuration
1. **Email provider** (Supabase Dashboard → Authentication → Providers → Email)
   - Enable email provider.
   - Disable email signups.
   - Disable confirm email.
2. **Environment variables**
   - Set the following in each Vercel project:
     - `NEXT_PUBLIC_SUPABASE_URL = https://YOUR-PROJECT-REF.supabase.co`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY = YOUR-ANON-KEY`
3. **Local/buildless previews**
   - Update `env.js` with the same values so static previews work without a build step.

## Files to Deploy
- `auth.html` – email/password login and magic-link form
- `auth/callback.html` – completes magic-link sign-in and returns to the app
- `auth.js` – Supabase client setup and form handlers
- `auth.css` – styles for both forms
- `auth-guard.js` – optional guard for protected pages

## Protected Pages
Add the guard script to any page that should require authentication:
```html
<script type="module" src="/auth-guard.js"></script>
```
The guard checks `supabase.auth.getSession()` and redirects to `/auth.html` when no session is present.

## Redirect Targets
Successful sign-ins navigate to `index.html`. Update the redirect targets in `auth.js` and `auth/callback.html` if your app uses a different landing page.

## Testing
- Submit the password form with a valid Supabase user to ensure session creation and redirect.
- Use the magic link form and confirm the email delivers a working link back to `/auth/callback.html`.
- Visit a protected page with and without an active session to confirm the guard behavior.
