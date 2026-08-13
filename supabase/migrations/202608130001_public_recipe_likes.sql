-- Likes for moderated public recipe snapshots.
-- One authenticated account may like a public recipe at most once.
-- Aggregate counts live on public_recipes so callers never need access to other users' ids.

alter table public.public_recipes
  add column if not exists like_count integer not null default 0
  check (like_count >= 0);

create table if not exists public.public_recipe_likes (
  recipe_id text not null references public.public_recipes(recipe_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (recipe_id,user_id)
);

create index if not exists public_recipe_likes_user_idx
  on public.public_recipe_likes(user_id,created_at desc);

alter table public.public_recipe_likes enable row level security;

revoke all on public.public_recipe_likes from anon,authenticated;
grant select,insert,delete on public.public_recipe_likes to authenticated;

-- Users may only see and mutate their own like rows. The public total is exposed
-- through public_recipes.like_count, not by exposing who liked what.
drop policy if exists "public recipe likes own select" on public.public_recipe_likes;
create policy "public recipe likes own select"
on public.public_recipe_likes for select to authenticated
using ((select auth.uid())=user_id);

drop policy if exists "public recipe likes own insert" on public.public_recipe_likes;
create policy "public recipe likes own insert"
on public.public_recipe_likes for insert to authenticated
with check ((select auth.uid())=user_id);

drop policy if exists "public recipe likes own delete" on public.public_recipe_likes;
create policy "public recipe likes own delete"
on public.public_recipe_likes for delete to authenticated
using ((select auth.uid())=user_id);

create or replace function private.update_public_recipe_like_count()
returns trigger
language plpgsql
security definer
set search_path = public,pg_catalog
as $$
begin
  if tg_op='INSERT' then
    update public.public_recipes
    set like_count=like_count+1,updated_at=now()
    where recipe_id=new.recipe_id;
    return new;
  elsif tg_op='DELETE' then
    update public.public_recipes
    set like_count=greatest(0,like_count-1),updated_at=now()
    where recipe_id=old.recipe_id;
    return old;
  end if;
  return null;
end $$;

revoke all on function private.update_public_recipe_like_count() from public,anon,authenticated;

drop trigger if exists public_recipe_likes_count_insert on public.public_recipe_likes;
create trigger public_recipe_likes_count_insert
after insert on public.public_recipe_likes
for each row execute function private.update_public_recipe_like_count();

drop trigger if exists public_recipe_likes_count_delete on public.public_recipe_likes;
create trigger public_recipe_likes_count_delete
after delete on public.public_recipe_likes
for each row execute function private.update_public_recipe_like_count();

-- Reconcile counts if this migration is re-applied after data already exists.
update public.public_recipes pr
set like_count=(
  select count(*)::integer from public.public_recipe_likes likes
  where likes.recipe_id=pr.recipe_id
);
