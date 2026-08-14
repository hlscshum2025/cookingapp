create table if not exists public.pantry_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  ingredient_key text not null,
  name text not null,
  category text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pantry_items_owner_key_unique unique(owner_id, ingredient_key)
);

alter table public.pantry_items enable row level security;

revoke all on public.pantry_items from anon;
grant select, insert, update, delete on public.pantry_items to authenticated;
grant select, insert, update, delete on public.pantry_items to service_role;

drop policy if exists pantry_items_select_own on public.pantry_items;
create policy pantry_items_select_own
on public.pantry_items
for select
to authenticated
using ((select auth.uid()) = owner_id);

drop policy if exists pantry_items_insert_own on public.pantry_items;
create policy pantry_items_insert_own
on public.pantry_items
for insert
to authenticated
with check ((select auth.uid()) = owner_id);

drop policy if exists pantry_items_update_own on public.pantry_items;
create policy pantry_items_update_own
on public.pantry_items
for update
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

drop policy if exists pantry_items_delete_own on public.pantry_items;
create policy pantry_items_delete_own
on public.pantry_items
for delete
to authenticated
using ((select auth.uid()) = owner_id);

create index if not exists pantry_items_owner_updated_idx
on public.pantry_items(owner_id, updated_at desc);
