-- Cover composite owner-scoped foreign keys reported by the Supabase advisor.

drop index if exists public.receipt_ocr_runs_receipt_idx;
create index if not exists receipt_ocr_runs_receipt_owner_created_idx
  on public.receipt_ocr_runs(receipt_id,owner_id,created_at desc);

drop index if exists public.shopping_receipt_items_receipt_idx;
create index if not exists shopping_receipt_items_receipt_owner_created_idx
  on public.shopping_receipt_items(receipt_id,owner_id,created_at);

drop index if exists public.shopping_receipt_items_run_idx;
create index if not exists shopping_receipt_items_run_owner_idx
  on public.shopping_receipt_items(ocr_run_id,owner_id)
  where ocr_run_id is not null;

drop index if exists public.purchase_records_source_item_idx;
create index if not exists purchase_records_source_item_owner_idx
  on public.purchase_records(source_receipt_item_id,owner_id)
  where source_receipt_item_id is not null;
