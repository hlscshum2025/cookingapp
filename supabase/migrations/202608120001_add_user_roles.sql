-- Application roles are intentionally stored outside user-editable profiles.
-- A missing row means a normal user. Only trusted database/admin operations may
-- create or modify role assignments.

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_roles enable row level security;

grant select on table public.user_roles to authenticated;
revoke insert, update, delete on table public.user_roles from anon, authenticated;

drop policy if exists "users read own role" on public.user_roles;
create policy "users read own role"
on public.user_roles
for select
to authenticated
using ((select auth.uid()) = user_id);

comment on table public.user_roles is
  'Application authorization roles. Client users may read only their own role; assignments are database/admin managed.';
