revoke all on table public.ledger_entries from public, anon, authenticated;
grant select, insert, delete on table public.ledger_entries to authenticated;
