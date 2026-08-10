-- CookingApp private-v1 RLS hardening.
--
-- This migration deliberately removes anonymous recipe reads. A later public
-- sharing feature must expose a security-invoker view or RPC containing only
-- an explicit public-field allowlist; the recipes.document column is private.

drop policy if exists "profiles own" on public.profiles;
create policy "profiles own"
on public.profiles
for all
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "recipes owner write" on public.recipes;
create policy "recipes owner write"
on public.recipes
for all
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

-- V1 is private-only. Row policies cannot hide selected JSON fields, so the
-- previous public row policy must not remain on the base table.
drop policy if exists "recipes public read" on public.recipes;

drop policy if exists "versions owner" on public.recipe_versions;
create policy "versions owner"
on public.recipe_versions
for all
to authenticated
using (
  (select auth.uid()) = owner_id
  and exists (
    select 1
    from public.recipes
    where recipes.id = recipe_versions.recipe_id
      and recipes.owner_id = (select auth.uid())
  )
)
with check (
  (select auth.uid()) = owner_id
  and exists (
    select 1
    from public.recipes
    where recipes.id = recipe_versions.recipe_id
      and recipes.owner_id = (select auth.uid())
  )
);

drop policy if exists "logs owner" on public.cooking_logs;
create policy "logs owner"
on public.cooking_logs
for all
to authenticated
using (
  (select auth.uid()) = owner_id
  and exists (
    select 1
    from public.recipes
    where recipes.id = cooking_logs.recipe_id
      and recipes.owner_id = (select auth.uid())
  )
)
with check (
  (select auth.uid()) = owner_id
  and exists (
    select 1
    from public.recipes
    where recipes.id = cooking_logs.recipe_id
      and recipes.owner_id = (select auth.uid())
  )
);

drop policy if exists "ingredients owner" on public.ingredients;
create policy "ingredients owner"
on public.ingredients
for all
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

drop policy if exists "sources owner" on public.source_videos;
create policy "sources owner"
on public.source_videos
for all
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

drop policy if exists "import jobs owner" on public.import_jobs;
create policy "import jobs owner"
on public.import_jobs
for all
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

drop policy if exists "import items owner" on public.import_items;
create policy "import items owner"
on public.import_items
for all
to authenticated
using (
  (select auth.uid()) = owner_id
  and exists (
    select 1
    from public.import_jobs
    where import_jobs.id = import_items.job_id
      and import_jobs.owner_id = (select auth.uid())
  )
  and (
    source_video_id is null
    or exists (
      select 1
      from public.source_videos
      where source_videos.id = import_items.source_video_id
        and source_videos.owner_id = (select auth.uid())
    )
  )
  and (
    recipe_id is null
    or exists (
      select 1
      from public.recipes
      where recipes.id = import_items.recipe_id
        and recipes.owner_id = (select auth.uid())
    )
  )
)
with check (
  (select auth.uid()) = owner_id
  and exists (
    select 1
    from public.import_jobs
    where import_jobs.id = import_items.job_id
      and import_jobs.owner_id = (select auth.uid())
  )
  and (
    source_video_id is null
    or exists (
      select 1
      from public.source_videos
      where source_videos.id = import_items.source_video_id
        and source_videos.owner_id = (select auth.uid())
    )
  )
  and (
    recipe_id is null
    or exists (
      select 1
      from public.recipes
      where recipes.id = import_items.recipe_id
        and recipes.owner_id = (select auth.uid())
    )
  )
);

drop policy if exists "tags owner" on public.tags;
create policy "tags owner"
on public.tags
for all
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

drop policy if exists "recipe tags owner" on public.recipe_tags;
create policy "recipe tags owner"
on public.recipe_tags
for all
to authenticated
using (
  (select auth.uid()) = owner_id
  and exists (
    select 1
    from public.recipes
    where recipes.id = recipe_tags.recipe_id
      and recipes.owner_id = (select auth.uid())
  )
  and exists (
    select 1
    from public.tags
    where tags.id = recipe_tags.tag_id
      and tags.owner_id = (select auth.uid())
  )
)
with check (
  (select auth.uid()) = owner_id
  and exists (
    select 1
    from public.recipes
    where recipes.id = recipe_tags.recipe_id
      and recipes.owner_id = (select auth.uid())
  )
  and exists (
    select 1
    from public.tags
    where tags.id = recipe_tags.tag_id
      and tags.owner_id = (select auth.uid())
  )
);

-- New functions receive EXECUTE for PUBLIC by default. Remove every inherited
-- and direct anonymous grant, then restore only the authenticated app role.
revoke all on function public.import_bilibili_favorites(jsonb, text, text)
from public, anon, authenticated;
grant execute on function public.import_bilibili_favorites(jsonb, text, text)
to authenticated;

revoke all on function public.save_manual_recipe(jsonb)
from public, anon, authenticated;
grant execute on function public.save_manual_recipe(jsonb)
to authenticated;
