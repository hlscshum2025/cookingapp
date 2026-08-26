-- Keep the import center as a pending-source inbox. Any recipe that is saved
-- from a source video completes that source automatically. This trigger is
-- SECURITY INVOKER and still respects the caller's RLS permissions.

create or replace function public.complete_source_video_from_recipe()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_source_id uuid;
  v_bvid text;
begin
  v_source_id := nullif(new.document->>'sourceVideoId','')::uuid;
  v_bvid := nullif(new.document->'source'->>'bvid','');

  if v_source_id is not null then
    update public.source_videos
    set workflow_status='completed', updated_at=now()
    where id=v_source_id and owner_id=new.owner_id;
  elsif v_bvid is not null then
    update public.source_videos
    set workflow_status='completed', updated_at=now()
    where owner_id=new.owner_id
      and platform='bilibili'
      and external_id=v_bvid;
  end if;
  return new;
end $$;

drop trigger if exists recipes_complete_source_after_save on public.recipes;
create trigger recipes_complete_source_after_save
after insert or update of document on public.recipes
for each row execute function public.complete_source_video_from_recipe();

revoke all on function public.complete_source_video_from_recipe() from public;
