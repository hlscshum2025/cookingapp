-- JSON favorites import is a source-ingestion step only.
-- It must never create placeholder recipes. A recipe is created only after
-- manual entry is explicitly saved by the user.

-- Remove only legacy placeholders produced by the old favorites RPC. These
-- rows have the deterministic video-* id, no structured content, and the old
-- B站导入 marker. Manually saved recipes are intentionally untouched.
delete from public.recipes
where id like 'video-%'
  and jsonb_typeof(document->'ingredients')='array'
  and jsonb_array_length(document->'ingredients')=0
  and jsonb_typeof(document->'steps')='array'
  and jsonb_array_length(document->'steps')=0
  and jsonb_typeof(document->'tags')='array'
  and document->'tags' @> '["B站导入"]'::jsonb;

-- Legacy placeholder recipes previously made sources look completed. Rebuild
-- workflow state from the real remaining recipes after the cleanup above.
update public.source_videos
set workflow_status='pending', updated_at=now();

update public.source_videos as source
set workflow_status='completed', updated_at=now()
where exists (
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

create or replace function public.import_bilibili_favorites(
  p_videos jsonb,
  p_collection_id text default null,
  p_file_name text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_owner uuid := auth.uid();
  v_job_id uuid;
  v_video jsonb;
  v_ordinal bigint;
  v_external_id text;
  v_title text;
  v_url text;
  v_uploader text;
  v_description text;
  v_cover_url text;
  v_source_id uuid;
  v_is_new boolean;
  v_total integer := jsonb_array_length(coalesce(p_videos,'[]'::jsonb));
  v_added integer := 0;
  v_duplicates integer := 0;
  v_failed integer := 0;
  v_skipped integer := 0;
begin
  if v_owner is null then raise exception 'authentication_required'; end if;
  if jsonb_typeof(coalesce(p_videos,'null'::jsonb)) <> 'array' then raise exception 'videos_must_be_an_array'; end if;

  insert into public.import_jobs(owner_id,source,source_collection_id,file_name,status,counters)
  values(v_owner,'bilibili_favorites',nullif(p_collection_id,''),nullif(p_file_name,''),'processing',jsonb_build_object('total',v_total,'added',0,'duplicates',0,'failed',0,'skipped',0))
  returning id into v_job_id;

  for v_video,v_ordinal in select value,ordinality from jsonb_array_elements(p_videos) with ordinality loop
    begin
      v_external_id := nullif(trim(coalesce(v_video->>'bvid',v_video->>'bvId',v_video->>'id','')),'');
      v_title := coalesce(nullif(trim(v_video->>'title'),''),'待整理视频');
      v_url := coalesce(nullif(trim(v_video->>'video_url'),''),nullif(trim(v_video->>'url'),''),case when v_external_id is not null then 'https://www.bilibili.com/video/'||v_external_id end);
      v_uploader := coalesce(nullif(trim(v_video->>'uploader'),''),nullif(trim(v_video->>'author'),''),'');
      v_description := coalesce(nullif(trim(v_video->>'intro'),''),nullif(trim(v_video->>'description'),''),'');
      v_cover_url := replace(coalesce(nullif(trim(v_video->>'cover_url'),''),nullif(trim(v_video->>'cover'),''),''),'http://','https://');

      if v_external_id is null or v_url is null or coalesce((v_video->>'invalid')::boolean,false) then
        v_skipped := v_skipped + 1;
        insert into public.import_items(owner_id,job_id,external_id,status,error_code,raw_metadata)
        values(v_owner,v_job_id,coalesce(v_external_id,'__row_'||v_ordinal),'skipped',case when coalesce((v_video->>'invalid')::boolean,false) then 'source_marked_invalid' else 'missing_external_id_or_url' end,coalesce(v_video->'raw',v_video));
        continue;
      end if;

      v_source_id := null;
      insert into public.source_videos(
        owner_id,platform,external_id,url,title,uploader_name,cover_url,description,
        availability,raw_metadata,duration_seconds,published_at,favorited_at,workflow_status
      )
      values(
        v_owner,'bilibili',v_external_id,v_url,v_title,nullif(v_uploader,''),nullif(v_cover_url,''),nullif(v_description,''),
        'available',coalesce(v_video->'raw',v_video),nullif(v_video->>'duration_seconds','')::integer,
        nullif(v_video->>'published_at','')::timestamptz,nullif(v_video->>'favorited_at','')::timestamptz,'pending'
      )
      on conflict(owner_id,platform,external_id) do nothing
      returning id into v_source_id;

      v_is_new := v_source_id is not null;
      if not v_is_new then
        select id into v_source_id
        from public.source_videos
        where owner_id=v_owner and platform='bilibili' and external_id=v_external_id;
        v_duplicates := v_duplicates + 1;
      else
        v_added := v_added + 1;
      end if;

      insert into public.import_items(owner_id,job_id,external_id,status,raw_metadata,source_video_id,recipe_id)
      values(v_owner,v_job_id,v_external_id,case when v_is_new then 'processed' else 'duplicate' end,coalesce(v_video->'raw',v_video),v_source_id,null)
      on conflict(job_id,external_id) do update set
        status=excluded.status,
        raw_metadata=excluded.raw_metadata,
        source_video_id=excluded.source_video_id,
        recipe_id=null;
    exception when others then
      v_failed := v_failed + 1;
      insert into public.import_items(owner_id,job_id,external_id,status,error_code,raw_metadata)
      values(v_owner,v_job_id,coalesce(v_external_id,'__row_'||v_ordinal),'failed',sqlstate,coalesce(v_video->'raw',v_video))
      on conflict(job_id,external_id) do update set status='failed',error_code=excluded.error_code,raw_metadata=excluded.raw_metadata;
    end;
  end loop;

  update public.import_jobs
  set status='completed',finished_at=now(),counters=jsonb_build_object('total',v_total,'added',v_added,'duplicates',v_duplicates,'failed',v_failed,'skipped',v_skipped)
  where id=v_job_id;

  return jsonb_build_object('jobId',v_job_id,'total',v_total,'added',v_added,'duplicates',v_duplicates,'failed',v_failed,'skipped',v_skipped);
exception when others then
  if v_job_id is not null then
    update public.import_jobs
    set status='failed',finished_at=now(),counters=jsonb_build_object('total',v_total,'added',v_added,'duplicates',v_duplicates,'failed',v_failed+1,'skipped',v_skipped)
    where id=v_job_id;
  end if;
  raise;
end $$;

revoke all on function public.import_bilibili_favorites(jsonb,text,text) from public;
grant execute on function public.import_bilibili_favorites(jsonb,text,text) to authenticated;
