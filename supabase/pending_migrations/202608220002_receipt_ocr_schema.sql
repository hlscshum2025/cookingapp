-- V2 receipt OCR and verified purchase records.
-- Apply to DEV first. Receipt images and raw OCR output remain owner-only.

create table if not exists public.shopping_receipts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  store_name text,
  store_country text check (store_country is null or store_country ~ '^[A-Z]{2}$'),
  purchased_at timestamptz,
  currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  total_amount numeric(12,2) check (total_amount is null or total_amount >= 0),
  image_bucket text not null default 'receipt-images' check (image_bucket = 'receipt-images'),
  image_path text,
  status text not null default 'uploaded'
    check (status in ('uploaded','processing','needs_review','confirmed','failed','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id,owner_id)
);

create table if not exists public.receipt_ocr_runs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  receipt_id uuid not null,
  provider text not null
    check (provider in ('paddleocr','apple_vision','mlkit','manual')),
  model_version text,
  preprocess_version text,
  status text not null default 'queued'
    check (status in ('queued','running','succeeded','failed')),
  raw_text text,
  raw_result jsonb not null default '{}'::jsonb
    check (jsonb_typeof(raw_result) = 'object'),
  error_message text,
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  created_at timestamptz not null default now(),
  unique(id,owner_id),
  constraint receipt_ocr_runs_receipt_owner_fk
    foreign key (receipt_id,owner_id)
    references public.shopping_receipts(id,owner_id)
    on delete cascade
);

create table if not exists public.shopping_receipt_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  receipt_id uuid not null,
  ocr_run_id uuid,
  raw_text text,
  raw_product_name text,
  ingredient_id text,
  canonical_ingredient_key text,
  quantity numeric check (quantity is null or quantity >= 0),
  quantity_unit text,
  package_amount numeric check (package_amount is null or package_amount >= 0),
  package_unit text,
  unit_price numeric(12,4) check (unit_price is null or unit_price >= 0),
  line_total numeric(12,2) check (line_total is null or line_total >= 0),
  bbox jsonb check (bbox is null or jsonb_typeof(bbox) in ('object','array')),
  confidence numeric(5,4) check (confidence is null or confidence between 0 and 1),
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified','user_verified','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id,owner_id),
  constraint shopping_receipt_items_receipt_owner_fk
    foreign key (receipt_id,owner_id)
    references public.shopping_receipts(id,owner_id)
    on delete cascade,
  constraint shopping_receipt_items_run_owner_fk
    foreign key (ocr_run_id,owner_id)
    references public.receipt_ocr_runs(id,owner_id)
    on delete cascade
);

create table if not exists public.purchase_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  ingredient_id text,
  canonical_ingredient_key text,
  source_receipt_item_id uuid,
  store_name text,
  purchased_at timestamptz,
  currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  quantity numeric check (quantity is null or quantity >= 0),
  unit text,
  package_amount numeric check (package_amount is null or package_amount >= 0),
  package_unit text,
  total_price numeric(12,2) check (total_price is null or total_price >= 0),
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified','user_verified','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint purchase_records_receipt_item_owner_fk
    foreign key (source_receipt_item_id,owner_id)
    references public.shopping_receipt_items(id,owner_id)
    on delete set null (source_receipt_item_id)
);

create table if not exists public.ingredient_market_aliases (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  ingredient_id text,
  canonical_ingredient_key text not null,
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  locale text not null check (locale in ('zh-CN','zh-TW','en','de')),
  store_name text,
  alias text not null check (char_length(trim(alias)) between 1 and 160),
  normalized_alias text not null check (char_length(trim(normalized_alias)) between 1 and 160),
  source text not null default 'user'
    check (source in ('user','receipt_ocr','admin','import')),
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified','user_verified','rejected')),
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists shopping_receipts_owner_purchased_idx
  on public.shopping_receipts(owner_id,purchased_at desc,created_at desc);
create index if not exists shopping_receipts_owner_status_idx
  on public.shopping_receipts(owner_id,status,updated_at desc);
create index if not exists receipt_ocr_runs_receipt_idx
  on public.receipt_ocr_runs(receipt_id,created_at desc);
create index if not exists receipt_ocr_runs_owner_status_idx
  on public.receipt_ocr_runs(owner_id,status,created_at desc);
create index if not exists shopping_receipt_items_receipt_idx
  on public.shopping_receipt_items(receipt_id,created_at);
create index if not exists shopping_receipt_items_run_idx
  on public.shopping_receipt_items(ocr_run_id)
  where ocr_run_id is not null;
create index if not exists shopping_receipt_items_owner_verification_idx
  on public.shopping_receipt_items(owner_id,verification_status,updated_at desc);
create index if not exists purchase_records_owner_purchased_idx
  on public.purchase_records(owner_id,purchased_at desc,created_at desc);
create index if not exists purchase_records_source_item_idx
  on public.purchase_records(source_receipt_item_id)
  where source_receipt_item_id is not null;
create index if not exists ingredient_market_aliases_lookup_idx
  on public.ingredient_market_aliases(owner_id,country_code,locale,normalized_alias);
create unique index if not exists ingredient_market_aliases_owner_unique_idx
  on public.ingredient_market_aliases(
    owner_id,canonical_ingredient_key,country_code,locale,coalesce(store_name,''),normalized_alias
  );

alter table public.shopping_receipts enable row level security;
alter table public.receipt_ocr_runs enable row level security;
alter table public.shopping_receipt_items enable row level security;
alter table public.purchase_records enable row level security;
alter table public.ingredient_market_aliases enable row level security;

revoke all privileges on table
  public.shopping_receipts,
  public.receipt_ocr_runs,
  public.shopping_receipt_items,
  public.purchase_records,
  public.ingredient_market_aliases
from anon, authenticated;

grant select,insert,update,delete on table
  public.shopping_receipts,
  public.receipt_ocr_runs,
  public.shopping_receipt_items,
  public.purchase_records,
  public.ingredient_market_aliases
to authenticated;

grant all privileges on table
  public.shopping_receipts,
  public.receipt_ocr_runs,
  public.shopping_receipt_items,
  public.purchase_records,
  public.ingredient_market_aliases
to service_role;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'shopping_receipts',
    'receipt_ocr_runs',
    'shopping_receipt_items',
    'purchase_records',
    'ingredient_market_aliases'
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
  'receipt-images',
  'receipt-images',
  false,
  15728640,
  array['image/jpeg','image/png','image/webp','image/heic','image/heif']
)
on conflict(id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "receipt images owner read" on storage.objects;
create policy "receipt images owner read" on storage.objects
for select to authenticated
using(bucket_id='receipt-images' and (storage.foldername(name))[1]=(select auth.uid())::text);

drop policy if exists "receipt images owner insert" on storage.objects;
create policy "receipt images owner insert" on storage.objects
for insert to authenticated
with check(bucket_id='receipt-images' and (storage.foldername(name))[1]=(select auth.uid())::text);

drop policy if exists "receipt images owner update" on storage.objects;
create policy "receipt images owner update" on storage.objects
for update to authenticated
using(bucket_id='receipt-images' and (storage.foldername(name))[1]=(select auth.uid())::text)
with check(bucket_id='receipt-images' and (storage.foldername(name))[1]=(select auth.uid())::text);

drop policy if exists "receipt images owner delete" on storage.objects;
create policy "receipt images owner delete" on storage.objects
for delete to authenticated
using(bucket_id='receipt-images' and (storage.foldername(name))[1]=(select auth.uid())::text);

comment on table public.shopping_receipts is
  'Owner-only receipt metadata. Original images live in the private receipt-images bucket.';
comment on table public.receipt_ocr_runs is
  'Immutable OCR attempts with provider/version/raw result for comparison and debugging.';
comment on table public.shopping_receipt_items is
  'OCR candidate lines. Unverified rows must not silently change purchase records or pantry stock.';
comment on table public.purchase_records is
  'Normalized purchase facts. Cost and pantry automation should use user_verified rows only.';
comment on table public.ingredient_market_aliases is
  'Owner-scoped market aliases linked to stable frontend canonical ingredient keys.';
