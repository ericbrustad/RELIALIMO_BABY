# RELIALIMO – Full Site Test Checklist

Use this as a repeatable smoke + functional test pass across every page.

## Test Run Info
- Date/time:
- Tester:
- Build/branch/commit:
- Base URL (local): `http://127.0.0.1:8080/`
- Browser(s): Chrome / Edge
- Auth mode: ✅ Sign-in required
- Notes:

## Preflight (Do Once)
- [ ] Start server and load `index.html` without a blank page.
- [ ] Open DevTools Console: no *blocking* errors on initial load.
- [ ] Open DevTools Network: no unexpected 404s for required JS/CSS.
- [ ] Hard refresh (Ctrl+Shift+R): app still loads.
- [ ] Optional reset: clear local storage for a clean run.
  - `Application → Storage → Local Storage → http://127.0.0.1:8080 → Clear`
- [ ] **Sign in before continuing** (this checklist assumes an authenticated session).
  - Open `auth.html` and sign in with a valid user.
  - Refresh and confirm you are still signed in.

## Global Navigation / Shell (Do On Each Page)
For each page you visit below:
- [ ] Header/Navigation renders correctly.
- [ ] Main content visible (no overlay/blank iframe).
- [ ] No console errors when interacting with page controls.
- [ ] Back/forward browser navigation behaves sensibly.
- [ ] You are not unexpectedly redirected to `auth.html`.

## Authentication (Required)
Pages: `auth.html`, `auth/callback.html` + any guarded pages.
- [ ] Open `auth.html`: sign-in UI loads.
- [ ] Sign in with a valid user: redirected to `index.html` (or expected landing).
- [ ] Refresh after sign-in: session persists (still signed in).
- [ ] Open `auth/callback.html` directly: does not crash; redirects as expected.

### Negative auth tests (Optional)
- [ ] Sign out: returns to signed-out state.
- [ ] Guarded page access while signed out redirects to `auth.html` (if configured).

## Dashboard / Home
Page: `index.html`
- [ ] Loads successfully.
- [ ] Switching sections/tabs works (no broken iframe messaging).
- [ ] Links/buttons take you to the expected pages.

## Reservations – End-to-End
### Reservations List
Page: `reservations-list.html`
- [ ] List loads (no sample rows lingering when DB is empty).
- [ ] Rows render with correct columns and reasonable formatting.
- [ ] Click a confirmation number: opens `reservation-form.html?conf=<id>`.
- [ ] Create a new reservation (below), return here: new reservation appears.

### Reservation Form – Create
Page: `reservation-form.html`
- [ ] Page loads with no console errors.
- [ ] Required fields can be entered and saved.
- [ ] Save creates a stable confirmation number/id.
- [ ] Save produces a valid pickup timestamp (PU Date + PU Time).
- [ ] After save, navigation returns to the intended page (often `reservations-list.html`).

### Reservation Form – Edit Existing
Page: `reservation-form.html?conf=<existing>`
- [ ] Existing data loads into the form.
- [ ] Edit a few fields and Save.
- [ ] Re-open the same `conf`: edits persist.

### Reservation Form – Autocomplete (3+ characters)
Billing / Passenger / Booking Agent fields
- [ ] Billing: type 3+ chars → account suggestions appear.
- [ ] Select a suggested account → billing fields populate correctly.
- [ ] Billing: Account # display shows the correct selected account number.
- [ ] Billing: blur the search field → selection resolves (no stale/incorrect account #).
- [ ] Passenger: type 3+ chars → passenger suggestions appear; select fills passenger.
- [ ] Booking Agent: type 3+ chars → booking agent suggestions; select fills booking agent.
- [ ] Click outside dropdown → dropdown closes.

### Reservation Form – Account Popup Flow
From Reservation Form (billing account selection)
- [ ] “Open Accounts” / related button opens `accounts.html` (popup or same tab).
- [ ] Create/select account in Accounts page.
- [ ] Return to reservation form: selected account is applied, and Account # display updates.

### Reservation Form – Copy / Roundtrip / Email (If Present)
- [ ] “Copy” flow creates draft and navigates as intended.
- [ ] “Roundtrip” flow creates return leg as intended.
- [ ] Email action opens mail client with sensible subject/body.

## Accounts
Page: `accounts.html`
- [ ] Page loads; list/search UI works.
- [ ] Create a new account (minimum required fields) → saved.
- [ ] Newly created account appears in list/search.
- [ ] Address fields (if present) save and reload correctly.
- [ ] If opened as a popup for reservation flow: selection posts back and closes/returns.

## Dispatch
### Dispatch Grid Setup
Page: `dispatch-grid-setup.html`
- [ ] Loads without console errors.
- [ ] Setup options can be changed and saved.

### Dispatch Grid
Page: `dispatch-grid.html`
- [ ] Loads; grid renders.
- [ ] Clicking a reservation opens `reservation-form.html?conf=<id>`.
- [ ] “Manage Resources” opens `manage-resources-modal.html` (popup or navigation).

### Manage Resources Modal
Page: `manage-resources-modal.html`
- [ ] Modal renders and can close/return without breaking parent.
- [ ] Any “Go to System Mapping” link works.

## Calendar
Page: `calendar.html`
- [ ] Loads and renders calendar.
- [ ] Navigation buttons route to expected pages (Office/Accounts/Quotes/Reservations).

## Quotes
Page: `quotes.html`
- [ ] Loads; toolbar/actions render.
- [ ] Create/save a quote (if supported) and verify it persists.
- [ ] Any tag/rate-tag selectors open and apply values correctly.

### Rate Tag Selector
Page: `ratetag-selector.html`
- [ ] Opens and selection returns/applies to caller (if used).

## Office / Operations
### My Office
Page: `my-office.html`
- [ ] Loads; key panels render.
- [ ] Any navigation buttons route correctly.

### Network
Page: `network.html`
- [ ] Loads without console errors.

### Files
Page: `files.html`
- [ ] Loads.

### Memos
Page: `memos.html`
- [ ] Loads.

### Tools
Page: `tools.html`
- [ ] Loads.

### Reports
Page: `reports.html`
- [ ] Loads.

## Accounting
### Payables
Page: `payables.html`
- [ ] Loads.

### Receivables
Page: `receivables.html`
- [ ] Loads.

### Settle
Page: `settle.html`
- [ ] Loads.

## Admin / Settings
### Appearance
Page: `appearance.html`
- [ ] Loads.
- [ ] Left-side settings navigation works.

### Service Types
Page: `service-types.html`
- [ ] Loads.
- [ ] Add/edit/delete service types (if supported) persists.

### System Mapping
Page: `system-mapping.html`
- [ ] Loads.
- [ ] Any mapping edits persist.

### Magic Link
Page: `magic-link.html`
- [ ] Loads.
- [ ] Any “generate link” flow works (if implemented).

### SMS Provider
Page: `sms-provider.html`
- [ ] Loads.
- [ ] Provider settings save and reload (if implemented).

## Driver/Vehicle Linking
Page: `link-drivers-cars.html`
- [ ] Loads.
- [ ] Link/unlink operations behave as expected.
- [ ] Close returns to parent without errors (postMessage if used).

## Supabase Integration (Optional)
These are for backend verification and will fail if Supabase/RLS isn’t configured.

### Integration Test Harness
Page: `test-supabase-integration.html`
- [ ] Header renders with the bull icon between RELIA and LIMO.
- [ ] Connection Test passes (URL/key loaded from `env.js`).

### Auth
- [ ] Sign in works (valid email/password).
- [ ] “Check Current User” shows the signed-in user.
- [ ] Sign out clears session.

### CRUD Tests
- [ ] Accounts: create + fetch works.
- [ ] Passengers: create + fetch works.
- [ ] Booking Agents: create + fetch works.
- [ ] Drivers: fetch works.

### RLS / Org Membership
If you see: `infinite recursion detected in policy for relation organization_members`
- [ ] Fix the recursive policy in Supabase (server-side), then rerun CRUD tests.
- [ ] Confirm the signed-in user has a row in `organization_members` for an org.

## Regression / Quality Gates
- [ ] No new console errors after a full pass through all pages.
- [ ] Refresh each major page: state persists where expected.
- [ ] Key flow sanity: Create reservation → appears in reservations list → open/edit → persists.

## Findings Log
Use this template per issue:
- Page:
- Steps to reproduce:
- Expected:
- Actual:
- Console/network errors:
- Severity (blocker/major/minor):
- Screenshot/recording:
