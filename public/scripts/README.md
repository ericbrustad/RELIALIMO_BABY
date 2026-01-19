generate-env.mjs

Purpose:
- Generate an `env.js` file that sets `window.ENV` from environment variables (.env during local dev or CI env vars during deployment).
- Ensures `env.js` is not committed to git (script will error if it detects it is tracked).

Usage:
- Locally: populate `.env` with your keys, then run:
  npm run generate-env

- CI / Deploy: set environment variables in your CI (SUPABASE_URL, SUPABASE_ANON_KEY, GOOGLE_MAPS_API_KEY, etc.) and run `npm run generate-env` as a build step.

Safety checks:
- Add `env.js` to `.gitignore` (done).
- Run `npm run check-env-untracked` to verify `env.js` is not committed.

Notes:
- `env.js` is public and any value it contains will be visible to users; only include public browser-safe keys (e.g., Maps browser key with HTTP referrer restrictions).
- For server-only secrets (service-role keys), keep them in your server environment and never add to `env.js`.
