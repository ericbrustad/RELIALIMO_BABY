# 🔐 Authentication Access Summary

## Current State
- **Email + password sign-in available:** `auth.html` now offers Supabase email/password login and magic link sign-in.
- **Magic link callback:** `auth/callback.html` completes the magic-link flow and returns the user to the app.
- **Auth guard enforced:** `auth-guard.js` redirects unauthenticated visitors back to `auth.html`.
- **Supabase-backed:** All auth calls use your `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` values (or `env.js` defaults during local builds).

## Key Files
```
/auth.html              - Login UI with password and magic-link forms
/auth.js                - Supabase client setup and form handlers
/auth.css               - Styles for the auth forms
/auth/callback.html     - Completes magic-link sign-in and redirects to the app
/auth-guard.js          - Optional guard that redirects to /auth.html when no session exists
/env.js                 - Browser-friendly Supabase environment defaults
/lib/supabase-browser.ts - Browser SDK helper (NEXT_PUBLIC_* aware)
/lib/supabase-server.ts  - Server SDK helper (SERVICE_ROLE + NEXT_PUBLIC_* aware)
```

## Access Flow
```
Visitor opens any protected page
    ↓
Auth guard checks Supabase session
    ↓
If no session → redirect to /auth.html
    ↓
Email/password or magic link sign-in
    ↓
Redirect to index.html once a Supabase session is established
```

## Supabase Settings
- **Providers > Email**: Enable email provider, disable email signups, disable email confirmation.
- **Vercel env vars**: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` must be set per project.

## Notes
- Update `env.js` with the same values if you need buildless/local previews.
- Default credentials remain in `env.js` but should be overridden in production via environment variables.
