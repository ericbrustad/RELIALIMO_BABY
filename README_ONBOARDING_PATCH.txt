RELIALIMO Onboarding Wizard (Page A)

Adds:
- driver-onboarding.html
- driver-onboarding.js

Usage:
- Start the Node server (server.js serves static).
- Open: http://localhost:3001/driver-onboarding.html (or your PORT)
- Wizard writes to Supabase tables via api-service.js:
  - drivers
  - affiliates (company_name)
  - fleet_vehicles (affiliate_id, vehicle_type_id, make/model/color/year/license_plate/permit_number/vin/usdot_number/mn_dot_number)

Notes:
- This is page-only wiring. Email + SMS verification and portal auth gating are the next step.
