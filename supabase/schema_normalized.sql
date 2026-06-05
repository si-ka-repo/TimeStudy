-- Normalized schema for TimeStudy (Supabase/Postgres)
-- Timezone strategy: store as timestamptz, display in Asia/Tokyo at app layer.

create extension if not exists pgcrypto;

-- =====================================================
-- 1) Tenants (法人)
-- =====================================================
create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

-- =====================================================
-- 2) App users (auth.users と 1:1)
-- =====================================================
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  display_name text not null,
  email text,
  role text not null default 'staff' check (role in ('owner','admin','manager','staff','viewer')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_users_tenant_id on public.users(tenant_id);
create index if not exists idx_users_role on public.users(role);

-- =====================================================
-- 3) Staff profiles (記録対象職員)
-- =====================================================
create table if not exists public.staff_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  staff_code text not null,
  staff_name text not null,
  job_type text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, staff_code)
);

create index if not exists idx_staff_profiles_tenant_id on public.staff_profiles(tenant_id);
create index if not exists idx_staff_profiles_name on public.staff_profiles(tenant_id, staff_name);

-- =====================================================
-- 4) Time categories (独立カテゴリ)
-- global_category_code を追加（法人間比較用）
-- =====================================================
create table if not exists public.time_categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  sub_no int not null check (sub_no between 1 and 9999),
  category_code text,
  category_name text not null,
  action_name text not null,
  global_category_code text,
  is_direct_care boolean not null default false,
  is_other boolean not null default false,
  display_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, sub_no)
);

create index if not exists idx_time_categories_tenant_id on public.time_categories(tenant_id);
create index if not exists idx_time_categories_global_code on public.time_categories(global_category_code);

-- =====================================================
-- 5) Survey sessions (1回の調査単位)
-- =====================================================
create table if not exists public.survey_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  session_date date not null,
  facility_name text,
  unit_name text,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  actual_start timestamptz,
  actual_end timestamptz,
  remarks text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_survey_sessions_tenant_date on public.survey_sessions(tenant_id, session_date);
create index if not exists idx_survey_sessions_created_by on public.survey_sessions(created_by);

-- =====================================================
-- 6) Time records (1区間=1レコード)
-- =====================================================
create table if not exists public.time_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  session_id uuid not null references public.survey_sessions(id) on delete cascade,
  staff_id uuid not null references public.staff_profiles(id) on delete restrict,
  category_id uuid not null references public.time_categories(id) on delete restrict,
  start_at timestamptz not null,
  end_at timestamptz not null,
  memo text,
  is_pending boolean not null default false,
  source text not null default 'app_log' check (source in ('app_log','manual_adjust','import')),
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (end_at > start_at)
);

create index if not exists idx_time_records_tenant_session on public.time_records(tenant_id, session_id);
create index if not exists idx_time_records_staff_time on public.time_records(tenant_id, staff_id, start_at);
create index if not exists idx_time_records_category on public.time_records(tenant_id, category_id);

-- =====================================================
-- 7) Time slots (画面C 10分補正)
-- =====================================================
create table if not exists public.time_slots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  session_id uuid not null references public.survey_sessions(id) on delete cascade,
  staff_id uuid not null references public.staff_profiles(id) on delete restrict,
  category_id uuid not null references public.time_categories(id) on delete restrict,
  slot_start_at timestamptz not null,
  minutes int not null check (minutes between 0 and 10),
  input_source text not null default 'manual' check (input_source in ('auto','manual')),
  updated_by uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (tenant_id, session_id, staff_id, category_id, slot_start_at)
);

create index if not exists idx_time_slots_tenant_session on public.time_slots(tenant_id, session_id);
create index if not exists idx_time_slots_slot_start on public.time_slots(tenant_id, slot_start_at);

-- =====================================================
-- 8) Work hour presets
-- =====================================================
create table if not exists public.work_hour_presets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  start_minute int not null check (start_minute between 0 and 1439),
  end_minute int not null check (end_minute between 0 and 1439),
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_work_hour_presets_tenant on public.work_hour_presets(tenant_id);

-- =====================================================
-- updated_at trigger helper
-- =====================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_time_slots_updated_at on public.time_slots;
create trigger trg_time_slots_updated_at
before update on public.time_slots
for each row execute function public.set_updated_at();

-- =====================================================
-- RLS (tenant isolation base)
-- =====================================================
alter table public.tenants enable row level security;
alter table public.users enable row level security;
alter table public.staff_profiles enable row level security;
alter table public.time_categories enable row level security;
alter table public.survey_sessions enable row level security;
alter table public.time_records enable row level security;
alter table public.time_slots enable row level security;
alter table public.work_hour_presets enable row level security;

-- helper: current user's tenant id
create or replace function public.current_tenant_id()
returns uuid
language sql
stable
as $$
  select u.tenant_id from public.users u where u.id = auth.uid()
$$;

-- tenants: own tenant only
DROP POLICY if exists tenants_select_own on public.tenants;
create policy tenants_select_own on public.tenants
for select
using (id = public.current_tenant_id());

-- users
DROP POLICY if exists users_rw_own_tenant on public.users;
create policy users_rw_own_tenant on public.users
for all
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());

-- common tenant policy macro expansion
DROP POLICY if exists staff_profiles_rw_tenant on public.staff_profiles;
create policy staff_profiles_rw_tenant on public.staff_profiles
for all
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());

DROP POLICY if exists time_categories_rw_tenant on public.time_categories;
create policy time_categories_rw_tenant on public.time_categories
for all
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());

DROP POLICY if exists survey_sessions_rw_tenant on public.survey_sessions;
create policy survey_sessions_rw_tenant on public.survey_sessions
for all
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());

DROP POLICY if exists time_records_rw_tenant on public.time_records;
create policy time_records_rw_tenant on public.time_records
for all
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());

DROP POLICY if exists time_slots_rw_tenant on public.time_slots;
create policy time_slots_rw_tenant on public.time_slots
for all
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());

DROP POLICY if exists work_hour_presets_rw_tenant on public.work_hour_presets;
create policy work_hour_presets_rw_tenant on public.work_hour_presets
for all
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());

-- =====================================================
-- Optional seed note
-- - Insert one tenant
-- - Insert users row for auth user
-- - Insert default 24 categories with global_category_code
-- =====================================================
