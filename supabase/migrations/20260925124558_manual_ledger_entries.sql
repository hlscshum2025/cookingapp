create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  description text not null check (char_length(btrim(description)) between 1 and 160),
  amount numeric(12,2) not null check (amount > 0),
  people_count integer not null default 1 check (people_count between 1 and 1000),
  happened_on date not null default current_date,
  currency text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  note text not null default '' check (char_length(note) <= 2000),
  created_at timestamptz not null default now()
);

create index ledger_entries_owner_date_idx
  on public.ledger_entries (owner_id, happened_on desc, created_at desc);

alter table public.ledger_entries enable row level security;

create policy ledger_entries_select_own
  on public.ledger_entries for select to authenticated
  using ((select auth.uid()) = owner_id);

create policy ledger_entries_insert_own
  on public.ledger_entries for insert to authenticated
  with check ((select auth.uid()) = owner_id);

create policy ledger_entries_delete_own
  on public.ledger_entries for delete to authenticated
  using ((select auth.uid()) = owner_id);

revoke all on table public.ledger_entries from public, anon, authenticated;
grant select, insert, delete on table public.ledger_entries to authenticated;
