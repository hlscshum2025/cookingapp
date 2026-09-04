-- Cover the direct auth.users(owner_id) foreign key on OCR input metadata.
create index if not exists ocr_job_files_owner_idx
  on public.ocr_job_files(owner_id);
