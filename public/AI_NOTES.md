# AI Notes (Keep in Sync)

## Supabase Schema Facts
- Drivers: table `public.drivers`; columns `id`, `first_name`, `last_name`, `dispatch_display_name`, `status` (ACTIVE/INACTIVE/SUSPENDED), `organization_id`. Use `dispatch_display_name` fallback to first/last for labels. Filter to `status = 'ACTIVE'`. Order by last, first.
- Vehicles: table `public.vehicles`; columns `id`, `veh_disp_name`, `unit_number`, `make`, `model`, `year`, `license_plate`, `veh_type`, `veh_title`, `status` (ACTIVE/INACTIVE/MAINTENANCE/OUT_OF_SERVICE/AVAILABLE/IN_USE/RETIRED), `organization_id`. Treat active as `status IN ('ACTIVE','AVAILABLE','IN_USE')`. Label fallback: `veh_disp_name` → `unit_number` → `make model year` → `license_plate`.
- Vehicle types: table `public.vehicle_types`; columns `id`, `name`, `code`, `status` (ACTIVE/INACTIVE), `sort_order`, `organization_id`. Filter to `status = 'ACTIVE'`; order by `sort_order`, `name`.

## Dropdown Data Sources (reservation form)
- Drivers dropdowns call `listDriverNames` (active only, using dispatch_display_name fallback) and filter to active statuses.
- Vehicle dropdowns call `listActiveVehiclesLight` (active statuses) for primary/secondary cars with the label fallback above.
- Vehicle Type dropdown calls `listActiveVehicleTypes`; falls back to deduped `veh_type` from active vehicles if the table is empty.

## RLS (Already Applied in Supabase)
- Org isolation via `organization_members(user_id, organization_id, role)`. Policies enforce `organization_id` membership for SELECT/INSERT/UPDATE/DELETE on `drivers`, `vehicles`, `vehicle_types`; optional role gates can be enabled if needed.

## Active Endpoints (api-service.js)
- `listDriverNames`: GET `/rest/v1/drivers?select=id,dispatch_display_name,first_name,last_name,status&status=eq.ACTIVE&order=last_name.asc,first_name.asc` (with apiFetch).
- `listActiveVehiclesLight`: GET `/rest/v1/vehicles?select=id,veh_disp_name,unit_number,make,model,year,license_plate,status,veh_type,veh_title&status=in.(ACTIVE,AVAILABLE,IN_USE)&order=veh_disp_name.asc,make.asc,model.asc,year.desc`.
- `listActiveVehicleTypes`: GET `/rest/v1/vehicle_types?select=id,name,code,status&status=eq.ACTIVE&order=sort_order.asc,name.asc`.

## Dev Fallbacks
- Localhost driver/vehicle fallbacks exist for dev convenience (localStorage) but Supabase is the source of truth; ensure production uses live endpoints.
