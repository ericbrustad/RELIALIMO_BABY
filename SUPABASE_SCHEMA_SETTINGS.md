# Supabase Settings Schema (Organization-wide Settings)

This defines two tables:
- `setting_definitions`: Inventory of all settings with metadata.
- `organization_settings`: One JSONB document per organization containing all settings.

Use SQL below in Supabase SQL editor.

---

## Table: setting_definitions

```sql
create table if not exists public.setting_definitions (
  id uuid default gen_random_uuid() primary key,
  key text not null unique,
  title text not null,
  category text not null, -- e.g., "My Office > Appearance"
  description text,
  data_type text not null check (data_type in ('string','number','boolean','json','enum')),
  default_value jsonb,
  options jsonb, -- for enum/list, optional
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger setting_definitions_updated_at
  before update on public.setting_definitions
  for each row
  execute procedure public.set_updated_at();
```

## Table: organization_settings

```sql
create table if not exists public.organization_settings (
  id uuid default gen_random_uuid() primary key,
  organization_id uuid not null,
  settings jsonb not null default '{}'::jsonb,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  constraint organization_settings_org_fk foreign key (organization_id)
    references public.organizations (id) on delete cascade,
  constraint organization_settings_org_unique unique (organization_id)
);

create index if not exists idx_organization_settings_org on public.organization_settings (organization_id);
create index if not exists idx_organization_settings_gin on public.organization_settings using gin (settings);

create trigger organization_settings_updated_at
  before update on public.organization_settings
  for each row
  execute procedure public.set_updated_at();
```

## Basic RLS (optional, adjust as needed)

```sql
alter table public.organization_settings enable row level security;

create policy org_settings_select on public.organization_settings
  for select using (
    exists (
      select 1 from public.organization_members m
      where m.organization_id = organization_settings.organization_id
        and m.user_id = auth.uid()
    )
  );

create policy org_settings_upsert on public.organization_settings
  for insert with check (
    exists (
      select 1 from public.organization_members m
      where m.organization_id = organization_settings.organization_id
        and m.user_id = auth.uid()
    )
  );

create policy org_settings_update on public.organization_settings
  for update using (
    exists (
      select 1 from public.organization_members m
      where m.organization_id = organization_settings.organization_id
        and m.user_id = auth.uid()
    )
  );
```

## Seed examples

```sql
insert into public.setting_definitions (key, title, category, data_type, default_value, description)
values
  ('confirmationNumberStart', 'Confirmation Number Start', 'My Office > Reservations', 'number', '100000', 'Starting number for sequential confirmation numbers'),
  ('prefillBehavior', 'Form Prefill Behavior', 'My Office > Reservations', 'enum', '{"default":"smart","options":["smart","none","aggressive"]}', 'Controls how forms prefill saved values'),
  ('dispatch.grid.timeSlotMinutes', 'Dispatch Grid Slot Minutes', 'My Office > Dispatch', 'number', '15', 'Minutes per slot in dispatch grid'),
  ('appearance.primaryColor', 'Primary Color', 'My Office > Appearance', 'string', '"#0B5FFF"', 'Main brand color');

insert into public.organization_settings (organization_id, settings)
values ('00000000-0000-0000-0000-000000000001', '{}')
on conflict (organization_id) do nothing;
```

## Notes
- Prefer storing all settings in `organization_settings.settings` JSONB for simplicity.
- `setting_definitions` is optional but recommended for inventory, defaults, and UI metadata.
- The app will upsert one row per organization in `organization_settings` and merge partial updates.
