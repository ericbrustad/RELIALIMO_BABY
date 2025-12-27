# Settings Seeding Guide

This project now includes an inventory and API helpers to create and manage your My Office settings in Supabase.

## 1) Create the Supabase tables
Open [SUPABASE_SCHEMA_SETTINGS.md](SUPABASE_SCHEMA_SETTINGS.md) and run the SQL blocks in the Supabase SQL Editor to create:
- `setting_definitions` (inventory/metadata)
- `organization_settings` (per-org JSONB settings)
- Optional RLS policies

## 2) Seed setting definitions from the local inventory
After the tables exist, you can seed `setting_definitions` from the local inventory file [settings-inventory.json](settings-inventory.json).

Option A: Run from the browser console on any app page after `api-service.js` is loaded:
```js
import('./api-service.js').then(m => m.seedSettingDefinitionsFromInventory());
```

Option B: Wire a temporary button in your admin UI that calls `seedSettingDefinitionsFromInventory()`.

## 3) Save and load org settings
The app uses `organization_settings` to persist settings per organization. The following helpers are available in [api-service.js](api-service.js):
- `fetchOrganizationSettings()`
- `upsertOrganizationSettings(partialSettings)`
- `listSettingDefinitions()` (reads local inventory first, falls back to Supabase)

`CompanySettingsManager` is wired to sync from Supabase on init and persist on save.

## Notes
- Local dev mode automatically falls back to `localStorage` for settings.
- Expand [settings-inventory.json](settings-inventory.json) during a tab-by-tab audit to cover all fields.
- Re-run the seeding helper when you add new inventory keys; existing keys are upserted.
