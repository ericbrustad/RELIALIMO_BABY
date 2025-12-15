# 🔐 Authentication Quick Reference Card

## Access
- **Auth page:** `/auth.html` shows email/password and magic-link forms backed by Supabase.
- **Magic link callback:** `/auth/callback.html` completes sign-in and routes users to `index.html`.
- **Guard:** Include `/auth-guard.js` on protected pages to enforce sessions.

## Key Files
| File | Purpose | Location |
|------|---------|----------|
| `auth.html` | Login UI | Root |
| `auth.js` | Supabase client + form handlers | Root |
| `auth.css` | Auth form styles | Root |
| `auth/callback.html` | Magic-link completion | `/auth` |
| `auth-guard.js` | Session check + redirect | Root |
| `env.js` | Browser env defaults | Root |

## Behavior
- Password sign-in redirects to `index.html` on success.
- Magic link emails redirect to `/auth/callback.html`, which forwards to `index.html` after verifying the session.
- `auth-guard.js` redirects unauthenticated visitors to `/auth.html`.

## Supabase Settings
- **Providers > Email**: Email provider ON, email signups OFF, confirm email OFF.
- **Vercel env vars**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- **Server secret**: `SUPABASE_SERVICE_ROLE_KEY` (kept in Vercel secrets) for calling the auth-config Edge Function with the required Authorization header.
- **Local**: Mirror the same values in `env.js`.

## Troubleshooting
| Situation | What to check |
|-----------|---------------|
| Error on sign-in | Confirm URL/key values and that the user exists in Supabase. |
| Magic link not delivered | Verify email provider is enabled and signups are disabled. |
| Unexpected redirects | Ensure `auth-guard.js` is only loaded on pages that require auth. |

## File Checklist
- [x] `/auth.html` - Login and magic link forms
- [x] `/auth.js` - Supabase handlers
- [x] `/auth-guard.js` - Guard enabled
- [x] `/auth/callback.html` - Magic link callback
