alter table public.pantry_items
add column if not exists storage_location text not null default 'fridge';

alter table public.pantry_items
drop constraint if exists pantry_items_storage_location_check;

alter table public.pantry_items
add constraint pantry_items_storage_location_check
check (storage_location in ('fridge','cabinet'));

create index if not exists pantry_items_owner_location_updated_idx
on public.pantry_items(owner_id,storage_location,updated_at desc);
