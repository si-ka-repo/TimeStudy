create table if not exists public.app_snapshots (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_app_snapshots_updated_at on public.app_snapshots;
create trigger trg_app_snapshots_updated_at
before update on public.app_snapshots
for each row execute function public.set_updated_at();

alter table public.app_snapshots enable row level security;

-- Testing phase policy: allow anon/authenticated read-write for snapshots.
-- Tighten this later with auth.uid() or tenant key conditions.
drop policy if exists app_snapshots_rw_all on public.app_snapshots;
create policy app_snapshots_rw_all on public.app_snapshots
for all
to anon, authenticated
using (true)
with check (true);
