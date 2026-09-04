-- Persistent OCR upload queue for a local/admin worker.
-- Apply to DEV first. Uploaded images remain private and owner-scoped.

create table if not exists public.ocr_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('receipt','xiaohongshu')),
  status text not null default 'uploading'
    check (status in ('uploading','queued','processing','review_required','completed','failed','cancelled')),
  file_count integer not null default 0 check (file_count between 0 and 12),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  worker_id text,
  result jsonb check (result is null or jsonb_typeof(result) = 'object'),
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id,owner_id)
);

create table if not exists public.ocr_job_files (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null,
  input_index integer not null check (input_index between 1 and 12),
  bucket_id text not null default 'ocr-inputs' check (bucket_id = 'ocr-inputs'),
  storage_path text not null check (char_length(trim(storage_path)) between 1 and 900),
  original_name text not null check (char_length(trim(original_name)) between 1 and 255),
  media_type text not null check (media_type in ('image/jpeg','image/png','image/webp')),
  byte_size bigint not null check (byte_size between 1 and 15728640),
  created_at timestamptz not null default now(),
  unique (job_id,input_index),
  unique (bucket_id,storage_path),
  constraint ocr_job_files_job_owner_fk
    foreign key (job_id,owner_id)
    references public.ocr_jobs(id,owner_id)
    on delete cascade
);

create index if not exists ocr_jobs_owner_created_idx
  on public.ocr_jobs(owner_id,created_at desc);
create index if not exists ocr_jobs_worker_queue_idx
  on public.ocr_jobs(status,created_at)
  where status = 'queued';
create index if not exists ocr_jobs_expiry_idx
  on public.ocr_jobs(expires_at)
  where status in ('completed','failed','cancelled');
create index if not exists ocr_job_files_job_owner_idx
  on public.ocr_job_files(job_id,owner_id,input_index);

alter table public.ocr_jobs enable row level security;
alter table public.ocr_job_files enable row level security;

revoke all privileges on table public.ocr_jobs,public.ocr_job_files
from anon,authenticated;

grant select,insert,delete on table public.ocr_jobs to authenticated;
grant update(status,file_count) on table public.ocr_jobs to authenticated;
grant select,insert,delete on table public.ocr_job_files to authenticated;
grant all privileges on table public.ocr_jobs,public.ocr_job_files to service_role;

drop policy if exists ocr_jobs_select_own on public.ocr_jobs;
create policy ocr_jobs_select_own on public.ocr_jobs
for select to authenticated
using ((select auth.uid()) = owner_id);

drop policy if exists ocr_jobs_insert_own on public.ocr_jobs;
create policy ocr_jobs_insert_own on public.ocr_jobs
for insert to authenticated
with check (
  (select auth.uid()) = owner_id
  and status = 'uploading'
  and file_count = 0
  and attempt_count = 0
  and result is null
  and worker_id is null
  and error_message is null
  and started_at is null
  and completed_at is null
  and expires_at > now()
  and expires_at <= now() + interval '7 days'
);

drop policy if exists ocr_jobs_update_own on public.ocr_jobs;
create policy ocr_jobs_update_own on public.ocr_jobs
for update to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

drop policy if exists ocr_jobs_delete_own on public.ocr_jobs;
create policy ocr_jobs_delete_own on public.ocr_jobs
for delete to authenticated
using ((select auth.uid()) = owner_id and status in ('uploading','queued','review_required','completed','failed','cancelled'));

drop policy if exists ocr_job_files_select_own on public.ocr_job_files;
create policy ocr_job_files_select_own on public.ocr_job_files
for select to authenticated
using ((select auth.uid()) = owner_id);

drop policy if exists ocr_job_files_insert_own on public.ocr_job_files;
create policy ocr_job_files_insert_own on public.ocr_job_files
for insert to authenticated
with check (
  (select auth.uid()) = owner_id
  and exists (
    select 1 from public.ocr_jobs job
    where job.id = ocr_job_files.job_id
      and job.owner_id = (select auth.uid())
      and job.status = 'uploading'
  )
);

drop policy if exists ocr_job_files_delete_own on public.ocr_job_files;
create policy ocr_job_files_delete_own on public.ocr_job_files
for delete to authenticated
using ((select auth.uid()) = owner_id);

create schema if not exists private;
revoke all on schema private from public,anon,authenticated;

create or replace function private.enforce_ocr_job_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  actual_file_count integer;
begin
  new.updated_at := now();
  if (select auth.uid()) is not null then
    if old.owner_id <> (select auth.uid()) or new.owner_id <> old.owner_id then
      raise exception 'OCR job ownership cannot be changed';
    end if;
    if not (
      (old.status = 'uploading' and new.status = 'queued')
      or (old.status in ('uploading','queued') and new.status = 'cancelled')
    ) then
      raise exception 'Invalid user OCR job status transition';
    end if;
    if new.status = 'queued' then
      select count(*)::integer into actual_file_count
      from public.ocr_job_files file
      where file.job_id = old.id and file.owner_id = old.owner_id;
      if actual_file_count not between 1 and 12 or new.file_count <> actual_file_count then
        raise exception 'OCR job file count does not match uploaded files';
      end if;
    elsif new.file_count <> old.file_count then
      raise exception 'OCR job file count cannot change while cancelling';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists ocr_jobs_enforce_transition on public.ocr_jobs;
create trigger ocr_jobs_enforce_transition
before update on public.ocr_jobs
for each row execute function private.enforce_ocr_job_transition();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'ocr-inputs',
  'ocr-inputs',
  false,
  15728640,
  array['image/jpeg','image/png','image/webp']
)
on conflict(id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "ocr inputs owner read" on storage.objects;
create policy "ocr inputs owner read" on storage.objects
for select to authenticated
using (bucket_id = 'ocr-inputs' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "ocr inputs owner insert" on storage.objects;
create policy "ocr inputs owner insert" on storage.objects
for insert to authenticated
with check (bucket_id = 'ocr-inputs' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "ocr inputs owner delete" on storage.objects;
create policy "ocr inputs owner delete" on storage.objects
for delete to authenticated
using (bucket_id = 'ocr-inputs' and (storage.foldername(name))[1] = (select auth.uid())::text);

comment on table public.ocr_jobs is
  'Persistent owner-scoped OCR queue. A trusted local worker writes results with a server-only secret key.';
comment on table public.ocr_job_files is
  'Ordered private input images for receipt or Xiaohongshu OCR jobs.';
