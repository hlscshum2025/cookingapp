-- Bridge the Python vision-candidate-v1 contract to owner-scoped dictionary
-- and pantry records. Apply after the receipt OCR schema, DEV first.

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='ingredients_id_owner_unique'
      and conrelid='public.ingredients'::regclass
  ) then
    alter table public.ingredients
      add constraint ingredients_id_owner_unique unique(id,owner_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='pantry_items_id_owner_unique'
      and conrelid='public.pantry_items'::regclass
  ) then
    alter table public.pantry_items
      add constraint pantry_items_id_owner_unique unique(id,owner_id);
  end if;
end $$;

alter table public.pantry_items
  add column if not exists ingredient_id text;

alter table public.receipt_ocr_runs
  add column if not exists schema_version text not null default 'receipt-ocr-draft-v1'
    check(char_length(trim(schema_version)) between 1 and 80);

alter table public.shopping_receipt_items
  add column if not exists currency text
    check(currency is null or currency ~ '^[A-Z]{3}$');

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='pantry_items_ingredient_owner_fk'
      and conrelid='public.pantry_items'::regclass
  ) then
    alter table public.pantry_items
      add constraint pantry_items_ingredient_owner_fk
      foreign key(ingredient_id,owner_id)
      references public.ingredients(id,owner_id)
      on delete set null (ingredient_id);
  end if;
end $$;

create index if not exists pantry_items_ingredient_owner_idx
  on public.pantry_items(ingredient_id,owner_id)
  where ingredient_id is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='shopping_receipt_items_ingredient_owner_fk'
      and conrelid='public.shopping_receipt_items'::regclass
  ) then
    alter table public.shopping_receipt_items
      add constraint shopping_receipt_items_ingredient_owner_fk
      foreign key(ingredient_id,owner_id)
      references public.ingredients(id,owner_id)
      on delete set null (ingredient_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname='purchase_records_ingredient_owner_fk'
      and conrelid='public.purchase_records'::regclass
  ) then
    alter table public.purchase_records
      add constraint purchase_records_ingredient_owner_fk
      foreign key(ingredient_id,owner_id)
      references public.ingredients(id,owner_id)
      on delete set null (ingredient_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname='ingredient_market_aliases_ingredient_owner_fk'
      and conrelid='public.ingredient_market_aliases'::regclass
  ) then
    alter table public.ingredient_market_aliases
      add constraint ingredient_market_aliases_ingredient_owner_fk
      foreign key(ingredient_id,owner_id)
      references public.ingredients(id,owner_id)
      on delete set null (ingredient_id);
  end if;
end $$;

alter table public.purchase_records
  add column if not exists pantry_item_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='purchase_records_pantry_owner_fk'
      and conrelid='public.purchase_records'::regclass
  ) then
    alter table public.purchase_records
      add constraint purchase_records_pantry_owner_fk
      foreign key(pantry_item_id,owner_id)
      references public.pantry_items(id,owner_id)
      on delete set null (pantry_item_id);
  end if;
end $$;

create index if not exists shopping_receipt_items_ingredient_owner_idx
  on public.shopping_receipt_items(ingredient_id,owner_id)
  where ingredient_id is not null;
create index if not exists purchase_records_ingredient_owner_idx
  on public.purchase_records(ingredient_id,owner_id)
  where ingredient_id is not null;
create index if not exists purchase_records_pantry_owner_idx
  on public.purchase_records(pantry_item_id,owner_id)
  where pantry_item_id is not null;
create index if not exists ingredient_market_aliases_ingredient_owner_idx
  on public.ingredient_market_aliases(ingredient_id,owner_id)
  where ingredient_id is not null;

create table if not exists public.inventory_observation_runs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  source_scene text not null default 'unknown'
    check(source_scene in ('fridge','tabletop','bagged','unknown')),
  image_bucket text not null default 'inventory-images'
    check(image_bucket='inventory-images'),
  image_path text,
  model_name text not null check(char_length(trim(model_name)) between 1 and 160),
  model_version text not null check(char_length(trim(model_version)) between 1 and 160),
  schema_version text not null default 'vision-candidate-v1'
    check(char_length(trim(schema_version)) between 1 and 80),
  status text not null default 'queued'
    check(status in ('queued','running','succeeded','needs_review','confirmed','failed','archived')),
  raw_result jsonb not null default '{}'::jsonb
    check(jsonb_typeof(raw_result)='object'),
  warnings jsonb not null default '[]'::jsonb
    check(jsonb_typeof(warnings)='array'),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id,owner_id)
);

create table if not exists public.inventory_observation_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  observation_run_id uuid not null,
  scene text not null check(scene in ('fridge','tabletop','bagged','unknown')),
  label text not null check(char_length(trim(label)) between 1 and 240),
  confidence numeric(5,4) not null check(confidence between 0 and 1),
  bbox jsonb not null check(jsonb_typeof(bbox)='object'),
  model_name text not null check(char_length(trim(model_name)) between 1 and 160),
  model_version text not null check(char_length(trim(model_version)) between 1 and 160),
  schema_version text not null default 'vision-candidate-v1'
    check(char_length(trim(schema_version)) between 1 and 80),
  ingredient_id text,
  canonical_ingredient_key text,
  mask_polygon jsonb check(mask_polygon is null or jsonb_typeof(mask_polygon)='array'),
  quantity_min integer not null default 1 check(quantity_min >= 0),
  quantity_max integer not null default 1 check(quantity_max >= quantity_min),
  evidence jsonb not null default '["visual_detection"]'::jsonb
    check(jsonb_typeof(evidence)='array'),
  verification_status text not null default 'unverified'
    check(verification_status in ('unverified','user_verified','rejected')),
  target_storage_location text
    check(target_storage_location is null or target_storage_location in ('fridge','cabinet')),
  pantry_item_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id,owner_id),
  constraint inventory_observation_items_run_owner_fk
    foreign key(observation_run_id,owner_id)
    references public.inventory_observation_runs(id,owner_id)
    on delete cascade,
  constraint inventory_observation_items_ingredient_owner_fk
    foreign key(ingredient_id,owner_id)
    references public.ingredients(id,owner_id)
    on delete set null (ingredient_id),
  constraint inventory_observation_items_pantry_owner_fk
    foreign key(pantry_item_id,owner_id)
    references public.pantry_items(id,owner_id)
    on delete set null (pantry_item_id),
  constraint inventory_observation_items_verified_pantry_check
    check(pantry_item_id is null or verification_status='user_verified')
);

create index if not exists inventory_observation_runs_owner_status_idx
  on public.inventory_observation_runs(owner_id,status,updated_at desc);
create index if not exists inventory_observation_items_run_owner_idx
  on public.inventory_observation_items(observation_run_id,owner_id,created_at);
create index if not exists inventory_observation_items_owner_review_idx
  on public.inventory_observation_items(owner_id,verification_status,updated_at desc);
create index if not exists inventory_observation_items_ingredient_owner_idx
  on public.inventory_observation_items(ingredient_id,owner_id)
  where ingredient_id is not null;
create index if not exists inventory_observation_items_pantry_owner_idx
  on public.inventory_observation_items(pantry_item_id,owner_id)
  where pantry_item_id is not null;

alter table public.inventory_observation_runs enable row level security;
alter table public.inventory_observation_items enable row level security;

revoke all privileges on table
  public.inventory_observation_runs,
  public.inventory_observation_items
from anon,authenticated;

grant select,insert,update,delete on table
  public.inventory_observation_runs,
  public.inventory_observation_items
to authenticated;

grant all privileges on table
  public.inventory_observation_runs,
  public.inventory_observation_items
to service_role;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'inventory_observation_runs',
    'inventory_observation_items'
  ] loop
    execute format('drop policy if exists %I on public.%I',table_name||'_select_own',table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select auth.uid())=owner_id)',
      table_name||'_select_own',table_name
    );
    execute format('drop policy if exists %I on public.%I',table_name||'_insert_own',table_name);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select auth.uid())=owner_id)',
      table_name||'_insert_own',table_name
    );
    execute format('drop policy if exists %I on public.%I',table_name||'_update_own',table_name);
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id)',
      table_name||'_update_own',table_name
    );
    execute format('drop policy if exists %I on public.%I',table_name||'_delete_own',table_name);
    execute format(
      'create policy %I on public.%I for delete to authenticated using ((select auth.uid())=owner_id)',
      table_name||'_delete_own',table_name
    );
  end loop;
end $$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'inventory-images',
  'inventory-images',
  false,
  15728640,
  array['image/jpeg','image/png','image/webp','image/heic','image/heif']
)
on conflict(id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "inventory images owner read" on storage.objects;
create policy "inventory images owner read" on storage.objects
for select to authenticated
using(bucket_id='inventory-images' and (storage.foldername(name))[1]=(select auth.uid())::text);

drop policy if exists "inventory images owner insert" on storage.objects;
create policy "inventory images owner insert" on storage.objects
for insert to authenticated
with check(bucket_id='inventory-images' and (storage.foldername(name))[1]=(select auth.uid())::text);

drop policy if exists "inventory images owner update" on storage.objects;
create policy "inventory images owner update" on storage.objects
for update to authenticated
using(bucket_id='inventory-images' and (storage.foldername(name))[1]=(select auth.uid())::text)
with check(bucket_id='inventory-images' and (storage.foldername(name))[1]=(select auth.uid())::text);

drop policy if exists "inventory images owner delete" on storage.objects;
create policy "inventory images owner delete" on storage.objects
for delete to authenticated
using(bucket_id='inventory-images' and (storage.foldername(name))[1]=(select auth.uid())::text);

comment on table public.inventory_observation_runs is
  'Owner-only image recognition attempts grouped by source image and model version.';
comment on table public.inventory_observation_items is
  'vision-candidate-v1 results. Candidates require user verification before linking to pantry_items.';
comment on column public.pantry_items.ingredient_id is
  'Optional owner-scoped link to the editable ingredient dictionary; ingredient_key remains the stable fallback.';
