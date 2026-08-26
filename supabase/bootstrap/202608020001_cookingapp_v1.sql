-- CookingApp V1 / Supabase PostgreSQL schema
-- Run once in Supabase Dashboard > SQL Editor. Safe to rerun.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  locale text not null default 'zh-CN',
  timezone text not null default 'Asia/Tokyo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recipes (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  summary text not null default '',
  status text not null default 'inbox' check (status in ('inbox','to_try','successful','needs_work','favorite','archived')),
  visibility text not null default 'private' check (visibility in ('private','public')),
  total_minutes integer check (total_minutes is null or total_minutes >= 0),
  document jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.recipe_versions (
  id uuid primary key default gen_random_uuid(),
  recipe_id text not null references public.recipes(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  version_no integer not null,
  version_type text not null default 'snapshot' check (version_type in ('source_extracted','personal_current','snapshot')),
  change_note text,
  document jsonb not null,
  created_at timestamptz not null default now(),
  unique(recipe_id, version_no)
);

create or replace function public.snapshot_recipe_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare next_version integer;
begin
  if old.document is distinct from new.document then
    select coalesce(max(version_no),0)+1 into next_version from public.recipe_versions where recipe_id=old.id;
    insert into public.recipe_versions(recipe_id,owner_id,version_no,version_type,change_note,document)
    values(old.id,old.owner_id,next_version,'snapshot','自动保存的历史版本',old.document);
  end if;
  new.updated_at=now();
  return new;
end $$;

drop trigger if exists recipes_snapshot_before_update on public.recipes;
create trigger recipes_snapshot_before_update before update on public.recipes for each row execute function public.snapshot_recipe_update();

create table if not exists public.cooking_logs (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  recipe_id text not null references public.recipes(id) on delete cascade,
  cooked_at date not null default current_date,
  rating integer check (rating between 1 and 5),
  document jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ingredients (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  canonical_name_zh text not null,
  name_en text,
  name_de text,
  aliases text[] not null default '{}',
  category text,
  gluten_status text not null default '需核验',
  verification_status text not null default 'unverified' check (verification_status in ('unverified','ai_suggested','user_verified','source_verified')),
  document jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, canonical_name_zh)
);

create table if not exists public.source_videos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  platform text not null default 'bilibili',
  external_id text not null,
  url text not null,
  title text,
  uploader_name text,
  cover_url text,
  description text,
  availability text not null default 'available',
  raw_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, platform, external_id)
);

create table if not exists public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  source text not null default 'bilibili_favorites',
  source_collection_id text,
  status text not null default 'pending' check (status in ('pending','processing','completed','failed')),
  counters jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists public.import_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.import_jobs(id) on delete cascade,
  external_id text not null,
  status text not null default 'pending' check (status in ('pending','processed','duplicate','failed','skipped')),
  error_code text,
  raw_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(job_id, external_id)
);

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  group_name text not null,
  slug text not null,
  name text not null,
  created_at timestamptz not null default now(),
  unique(owner_id, group_name, slug)
);

create table if not exists public.recipe_tags (
  recipe_id text not null references public.recipes(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  confirmed boolean not null default true,
  primary key(recipe_id, tag_id)
);

create index if not exists recipes_owner_status_idx on public.recipes(owner_id,status,updated_at desc) where deleted_at is null;
create index if not exists recipe_versions_recipe_idx on public.recipe_versions(recipe_id,version_no desc);
create index if not exists cooking_logs_recipe_idx on public.cooking_logs(recipe_id,cooked_at desc);
create index if not exists ingredients_names_idx on public.ingredients(owner_id,canonical_name_zh,name_en,name_de);
create index if not exists import_items_job_idx on public.import_items(job_id,status);

alter table public.profiles enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_versions enable row level security;
alter table public.cooking_logs enable row level security;
alter table public.ingredients enable row level security;
alter table public.source_videos enable row level security;
alter table public.import_jobs enable row level security;
alter table public.import_items enable row level security;
alter table public.tags enable row level security;
alter table public.recipe_tags enable row level security;

drop policy if exists "profiles own" on public.profiles;
create policy "profiles own" on public.profiles for all using (auth.uid()=id) with check (auth.uid()=id);

drop policy if exists "recipes owner write" on public.recipes;
create policy "recipes owner write" on public.recipes for all using (auth.uid()=owner_id) with check (auth.uid()=owner_id);
drop policy if exists "recipes public read" on public.recipes;
create policy "recipes public read" on public.recipes for select using (visibility='public' and deleted_at is null);

drop policy if exists "versions owner" on public.recipe_versions;
create policy "versions owner" on public.recipe_versions for all using (auth.uid()=owner_id) with check (auth.uid()=owner_id);
drop policy if exists "logs owner" on public.cooking_logs;
create policy "logs owner" on public.cooking_logs for all using (auth.uid()=owner_id) with check (auth.uid()=owner_id);
drop policy if exists "ingredients owner" on public.ingredients;
create policy "ingredients owner" on public.ingredients for all using (auth.uid()=owner_id) with check (auth.uid()=owner_id);
drop policy if exists "sources owner" on public.source_videos;
create policy "sources owner" on public.source_videos for all using (auth.uid()=owner_id) with check (auth.uid()=owner_id);
drop policy if exists "import jobs owner" on public.import_jobs;
create policy "import jobs owner" on public.import_jobs for all using (auth.uid()=owner_id) with check (auth.uid()=owner_id);
drop policy if exists "import items owner" on public.import_items;
create policy "import items owner" on public.import_items for all using (auth.uid()=owner_id) with check (auth.uid()=owner_id);
drop policy if exists "tags owner" on public.tags;
create policy "tags owner" on public.tags for all using (auth.uid()=owner_id) with check (auth.uid()=owner_id);
drop policy if exists "recipe tags owner" on public.recipe_tags;
create policy "recipe tags owner" on public.recipe_tags for all using (auth.uid()=owner_id) with check (auth.uid()=owner_id);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('recipe-images','recipe-images',false,10485760,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict(id) do update set public=false,file_size_limit=10485760,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "recipe images owner read" on storage.objects;
create policy "recipe images owner read" on storage.objects for select to authenticated
using(bucket_id='recipe-images' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "recipe images owner insert" on storage.objects;
create policy "recipe images owner insert" on storage.objects for insert to authenticated
with check(bucket_id='recipe-images' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "recipe images owner update" on storage.objects;
create policy "recipe images owner update" on storage.objects for update to authenticated
using(bucket_id='recipe-images' and (storage.foldername(name))[1]=auth.uid()::text)
with check(bucket_id='recipe-images' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "recipe images owner delete" on storage.objects;
create policy "recipe images owner delete" on storage.objects for delete to authenticated
using(bucket_id='recipe-images' and (storage.foldername(name))[1]=auth.uid()::text);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
begin insert into public.profiles(id,display_name) values(new.id,coalesce(new.raw_user_meta_data->>'name',split_part(new.email,'@',1))) on conflict(id) do nothing; return new; end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
