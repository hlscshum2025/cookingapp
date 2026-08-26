-- Durable user feedback queue. Submission is available to signed-in users;
-- triage and status changes are restricted to application administrators.

create table if not exists public.feedback_submissions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('platform_request','bug','feature','content_change')),
  title text not null check (char_length(title) between 2 and 120),
  details text not null check (char_length(details) between 8 and 4000),
  context jsonb not null default '{}'::jsonb check (jsonb_typeof(context)='object'),
  status text not null default 'new' check (status in ('new','triaged','planned','resolved','declined')),
  priority text not null default 'p3' check (priority in ('p0','p1','p2','p3')),
  admin_note text check (admin_note is null or char_length(admin_note)<=4000),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists feedback_submissions_owner_idx
  on public.feedback_submissions(owner_id,created_at desc);
create index if not exists feedback_submissions_queue_idx
  on public.feedback_submissions(status,priority,created_at asc);
create index if not exists feedback_submissions_reviewed_by_idx
  on public.feedback_submissions(reviewed_by)
  where reviewed_by is not null;

alter table public.feedback_submissions enable row level security;

revoke all privileges on table public.feedback_submissions from anon, authenticated;
grant select, insert, update on table public.feedback_submissions to authenticated;

drop policy if exists "feedback read own or admin" on public.feedback_submissions;
create policy "feedback read own or admin"
on public.feedback_submissions for select to authenticated
using ((select auth.uid())=owner_id or private.is_current_admin());

drop policy if exists "feedback submit own" on public.feedback_submissions;
create policy "feedback submit own"
on public.feedback_submissions for insert to authenticated
with check (
  (select auth.uid())=owner_id
  and status='new'
  and priority='p3'
  and admin_note is null
  and reviewed_by is null
  and reviewed_at is null
);

drop policy if exists "feedback admin update" on public.feedback_submissions;
create policy "feedback admin update"
on public.feedback_submissions for update to authenticated
using (private.is_current_admin())
with check (private.is_current_admin());

comment on table public.feedback_submissions is
  'Private user feedback queue. Owners read their own rows; admins triage all rows. Confirmed product decisions are summarized separately in docs/99.';
