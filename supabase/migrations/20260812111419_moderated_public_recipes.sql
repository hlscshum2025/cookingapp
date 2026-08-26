-- Moderated public recipe publishing for CookingApp.
-- Private recipes remain owner-only. Users submit a safe snapshot for review;
-- admins approve/reject it; approved snapshots are stored separately in
-- public_recipes so later private edits do not bypass moderation.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.is_current_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = (select auth.uid()) and role = 'admin'
  );
$$;
revoke all on function private.is_current_admin() from public, anon;
grant execute on function private.is_current_admin() to authenticated;

create table if not exists public.recipe_publication_requests (
  id uuid primary key default gen_random_uuid(),
  recipe_id text not null references public.recipes(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  summary text not null default '',
  snapshot jsonb not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists recipe_publication_one_pending_idx
  on public.recipe_publication_requests(recipe_id)
  where status='pending';
create index if not exists recipe_publication_owner_idx
  on public.recipe_publication_requests(owner_id,submitted_at desc);
create index if not exists recipe_publication_status_idx
  on public.recipe_publication_requests(status,submitted_at asc);

create table if not exists public.public_recipes (
  recipe_id text primary key references public.recipes(id) on delete cascade,
  publication_request_id uuid not null references public.recipe_publication_requests(id) on delete restrict,
  title text not null,
  summary text not null default '',
  snapshot jsonb not null,
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists public_recipes_published_idx on public.public_recipes(published_at desc);

alter table public.recipe_publication_requests enable row level security;
alter table public.public_recipes enable row level security;

revoke all on public.recipe_publication_requests from anon, authenticated;
grant select on public.recipe_publication_requests to authenticated;
revoke all on public.public_recipes from anon, authenticated;
grant select on public.public_recipes to anon, authenticated;

drop policy if exists "publication requests read" on public.recipe_publication_requests;
create policy "publication requests read"
on public.recipe_publication_requests for select to authenticated
using ((select auth.uid())=owner_id or private.is_current_admin());

drop policy if exists "approved public recipes read" on public.public_recipes;
create policy "approved public recipes read"
on public.public_recipes for select to anon, authenticated
using (true);

-- The old visibility field remains for backwards-compatible Recipe typing, but
-- publication is no longer controlled by owners writing visibility='public'.
update public.recipes
set visibility='private',
    document=jsonb_set(document,'{visibility}','"private"'::jsonb,true)
where visibility<>'private' or coalesce(document->>'visibility','private')<>'private';

drop policy if exists "recipes owner write" on public.recipes;
drop policy if exists "recipes public read" on public.recipes;
drop policy if exists "recipes owner select" on public.recipes;
drop policy if exists "recipes owner insert" on public.recipes;
drop policy if exists "recipes owner update" on public.recipes;
drop policy if exists "recipes owner delete" on public.recipes;
create policy "recipes owner select" on public.recipes for select to authenticated
using ((select auth.uid())=owner_id);
create policy "recipes owner insert" on public.recipes for insert to authenticated
with check ((select auth.uid())=owner_id and visibility='private');
create policy "recipes owner update" on public.recipes for update to authenticated
using ((select auth.uid())=owner_id)
with check ((select auth.uid())=owner_id and visibility='private');
create policy "recipes owner delete" on public.recipes for delete to authenticated
using ((select auth.uid())=owner_id);

create or replace function private.submit_recipe_publication_internal(p_recipe_id text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_owner uuid := auth.uid();
  v_recipe public.recipes%rowtype;
  v_request_id uuid;
  v_source jsonb;
  v_snapshot jsonb;
begin
  if v_owner is null then raise exception 'authentication_required'; end if;
  select * into v_recipe from public.recipes
  where id=p_recipe_id and owner_id=v_owner and deleted_at is null;
  if not found then raise exception 'recipe_not_found_or_not_owned'; end if;
  if exists(select 1 from public.recipe_publication_requests where recipe_id=p_recipe_id and status='pending') then
    raise exception 'publication_already_pending';
  end if;

  v_source := case when jsonb_typeof(v_recipe.document->'source')='object' then
    jsonb_strip_nulls(jsonb_build_object(
      'platform',v_recipe.document->'source'->>'platform',
      'title',v_recipe.document->'source'->>'title',
      'url',v_recipe.document->'source'->>'url',
      'bvid',v_recipe.document->'source'->>'bvid',
      'uploader',v_recipe.document->'source'->>'uploader'
    )) else null end;

  -- Explicit allowlist: never publish logs, subtitle/OCR evidence, contentReview,
  -- import metadata, owner ids, role data, or version notes.
  v_snapshot := jsonb_strip_nulls(jsonb_build_object(
    'id',v_recipe.id,
    'title',v_recipe.title,
    'summary',v_recipe.summary,
    'emoji',coalesce(v_recipe.document->>'emoji','🍳'),
    'color',coalesce(v_recipe.document->>'color','linear-gradient(135deg,#e8c990,#d68353)'),
    'servings',coalesce(v_recipe.document->'servings','2'::jsonb),
    'totalMinutes',coalesce(v_recipe.document->'totalMinutes',to_jsonb(coalesce(v_recipe.total_minutes,0))),
    'activeMinutes',v_recipe.document->'activeMinutes',
    'unattendedMinutes',v_recipe.document->'unattendedMinutes',
    'advancePrepMinutes',v_recipe.document->'advancePrepMinutes',
    'advancePrepNote',v_recipe.document->'advancePrepNote',
    'difficulty',coalesce(v_recipe.document->>'difficulty','简单'),
    'status','successful',
    'visibility','public',
    'tags',coalesce(v_recipe.document->'tags','[]'::jsonb),
    'tools',coalesce(v_recipe.document->'tools','[]'::jsonb),
    'source',v_source,
    'ingredients',coalesce(v_recipe.document->'ingredients','[]'::jsonb),
    'steps',coalesce(v_recipe.document->'steps','[]'::jsonb),
    'versionNote','',
    'updatedAt',coalesce(v_recipe.document->>'updatedAt',to_char(current_date,'YYYY-MM-DD'))
  ));

  insert into public.recipe_publication_requests(recipe_id,owner_id,title,summary,snapshot,status)
  values(v_recipe.id,v_owner,v_recipe.title,v_recipe.summary,v_snapshot,'pending')
  returning id into v_request_id;
  return v_request_id;
end $$;
revoke all on function private.submit_recipe_publication_internal(text) from public, anon;
grant execute on function private.submit_recipe_publication_internal(text) to authenticated;

create or replace function public.submit_recipe_publication(p_recipe_id text)
returns uuid
language sql
security invoker
set search_path = private, public, pg_catalog
as $$ select private.submit_recipe_publication_internal(p_recipe_id); $$;
revoke all on function public.submit_recipe_publication(text) from public, anon;
grant execute on function public.submit_recipe_publication(text) to authenticated;

create or replace function private.review_recipe_publication_internal(p_request_id uuid,p_decision text,p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_admin uuid := auth.uid();
  v_request public.recipe_publication_requests%rowtype;
begin
  if v_admin is null or not private.is_current_admin() then raise exception 'admin_required'; end if;
  if p_decision not in ('approved','rejected') then raise exception 'invalid_decision'; end if;
  select * into v_request from public.recipe_publication_requests where id=p_request_id for update;
  if not found then raise exception 'publication_request_not_found'; end if;
  if v_request.status<>'pending' then raise exception 'publication_request_not_pending'; end if;

  update public.recipe_publication_requests
  set status=p_decision,reviewed_at=now(),reviewed_by=v_admin,
      review_note=nullif(trim(coalesce(p_note,'')),''),updated_at=now()
  where id=p_request_id;

  if p_decision='approved' then
    insert into public.public_recipes(recipe_id,publication_request_id,title,summary,snapshot,published_at,updated_at)
    values(v_request.recipe_id,v_request.id,v_request.title,v_request.summary,v_request.snapshot,now(),now())
    on conflict(recipe_id) do update set
      publication_request_id=excluded.publication_request_id,
      title=excluded.title,
      summary=excluded.summary,
      snapshot=excluded.snapshot,
      published_at=excluded.published_at,
      updated_at=now();
  end if;

  return jsonb_build_object('requestId',p_request_id,'decision',p_decision,'recipeId',v_request.recipe_id);
end $$;
revoke all on function private.review_recipe_publication_internal(uuid,text,text) from public, anon;
grant execute on function private.review_recipe_publication_internal(uuid,text,text) to authenticated;

create or replace function public.review_recipe_publication(p_request_id uuid,p_decision text,p_note text default null)
returns jsonb
language sql
security invoker
set search_path = private, public, pg_catalog
as $$ select private.review_recipe_publication_internal(p_request_id,p_decision,p_note); $$;
revoke all on function public.review_recipe_publication(uuid,text,text) from public, anon;
grant execute on function public.review_recipe_publication(uuid,text,text) to authenticated;
