-- Keep the import workspace as an inbox: imported source videos start pending
-- and disappear from the active queue once they have been handled.

alter table public.source_videos
  add column if not exists workflow_status text not null default 'pending';

alter table public.source_videos
  drop constraint if exists source_videos_workflow_status_check;
alter table public.source_videos
  add constraint source_videos_workflow_status_check
  check (workflow_status in ('pending','completed'));

-- Existing source rows that already have a saved recipe are considered handled.
update public.source_videos as source
set workflow_status='completed', updated_at=now()
where workflow_status='pending'
  and exists (
    select 1
    from public.recipes as recipe
    where recipe.owner_id=source.owner_id
      and recipe.deleted_at is null
      and (
        recipe.document->>'sourceVideoId'=source.id::text
        or (
          source.platform='bilibili'
          and recipe.document->'source'->>'bvid'=source.external_id
        )
      )
  );

create index if not exists source_videos_owner_workflow_idx
  on public.source_videos(owner_id,workflow_status,updated_at desc);
