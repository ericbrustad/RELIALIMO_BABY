# RELIA🐂LIMO™ Quick Start

## 🚀 5-Minute Setup
1. Deploy the site (Netlify/Vercel ready).
2. Configure Supabase environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL = https://YOUR-PROJECT-REF.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY = YOUR-ANON-KEY`
3. Mirror the values in `env.js` for static previews (optional).
4. Deploy `auth.html` and `auth/callback.html`.
5. Test email/password login and magic-link sign-in.

## 📁 Key Files
- **`/auth.html`** – Email/password + magic link forms.
- **`/auth.js`** – Supabase client and form handlers.
- **`/auth/callback.html`** – Completes magic-link auth.
- **`/auth-guard.js`** – Redirects unauthenticated users to `/auth.html`.
- **`/env.js`** – Browser-friendly Supabase defaults.
- **`/supabase-client.js`** – REST client for data queries.
- **`/lib/supabase-browser.ts` / `/lib/supabase-server.ts`** – SDK helpers using `NEXT_PUBLIC_*` values.

## 🔐 Access
- Password sign-in redirects to `index.html` on success.
- Magic link emails open `/auth/callback.html`, which forwards to `index.html` when a session exists.
- Add `<script type="module" src="/auth-guard.js"></script>` on pages that require authentication.

## ✅ What's Working Now
- Supabase-backed sign-in via password or magic link.
- Guarded navigation for protected pages.
- Static previews using `env.js` when environment variables are unavailable.

## 🧪 Testing Checklist
- [ ] Log in with a valid Supabase user via the password form.
- [ ] Trigger a magic link and confirm redirect from `/auth/callback.html` to the app.
- [ ] Visit a guarded page without a session and confirm redirect to `/auth.html`.

## 🆘 Troubleshooting
- **Sign-in errors:** Confirm `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set; ensure the user exists and email signups are disabled.
- **Magic link not delivered:** Verify the email provider is enabled and the redirect URL matches your deployment domain.
- **Redirect loops:** Ensure the guard script only runs where auth is required and that Supabase credentials are valid.

## 📚 More Documentation
- **Authentication Setup**: `/AUTH_SETUP.md`
- **Authentication Quick Reference**: `/AUTH_QUICK_REFERENCE.md`
- **API Service**: `/api-service.js` (JSDoc documented)
