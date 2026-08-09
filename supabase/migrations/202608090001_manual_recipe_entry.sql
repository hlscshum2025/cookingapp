-- Atomic manual source / recipe / source-version write for CookingApp.
-- Run after 202608030001_import_audit.sql. Safe to rerun.

create or replace function public.save_manual_recipe(p_payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_owner uuid := auth.uid();
  v_source jsonb := coalesce(p_payload->'source','{}'::jsonb);
  v_recipe jsonb := coalesce(p_payload->'recipe','{}'::jsonb);
  v_review jsonb := coalesce(p_payload->'review','{}'::jsonb);
  v_external_id text := nullif(trim(v_source->>'externalId'),'');
  v_platform text := coalesce(nullif(trim(v_source->>'platform'),''),'bilibili');
  v_candidate_key text := coalesce(nullif(trim(v_recipe->>'candidateKey'),''),'main');
  v_source_id uuid;
  v_recipe_id text := nullif(trim(v_recipe->>'id'),'');
  v_saved_recipe_id text;
  v_version_id uuid;
  v_version_no integer;
  v_source_metadata jsonb;
  v_recipe_document jsonb;
begin
  if v_owner is null then raise exception 'authentication_required'; end if;
  if nullif(trim(v_recipe->>'title'),'') is null then raise exception 'recipe_title_required'; end if;
  if v_platform='bilibili' and v_external_id is not null and v_external_id !~ '^BV[0-9A-Za-z]+$' then raise exception 'invalid_bilibili_external_id'; end if;

  v_source_metadata := jsonb_strip_nulls(jsonb_build_object(
    'entryMode','manual_gui',
    'subtitle',case when p_payload ? 'subtitle' then p_payload->'subtitle' else null end,
    'contentReview',v_review,
    'lastManualEntryAt',now()
  ));

  if v_external_id is not null then
    insert into public.source_videos(owner_id,platform,external_id,url,title,uploader_name,cover_url,description,availability,raw_metadata,duration_seconds,updated_at)
    values(
      v_owner,
      v_platform,
      v_external_id,
      coalesce(nullif(trim(v_source->>'url'),''),'https://www.bilibili.com/video/'||v_external_id),
      nullif(trim(v_source->>'title'),''),
      nullif(trim(v_source->>'uploaderName'),''),
      nullif(trim(v_source->>'coverUrl'),''),
      nullif(trim(v_source->>'description'),''),
      'available',
      v_source_metadata,
      nullif(v_source->>'durationSeconds','')::integer,
      now()
    )
    on conflict(owner_id,platform,external_id) do update set
      url=coalesce(nullif(excluded.url,''),source_videos.url),
      title=coalesce(excluded.title,source_videos.title),
      uploader_name=coalesce(excluded.uploader_name,source_videos.uploader_name),
      cover_url=coalesce(excluded.cover_url,source_videos.cover_url),
      description=coalesce(excluded.description,source_videos.description),
      availability='available',
      raw_metadata=coalesce(source_videos.raw_metadata,'{}'::jsonb)||excluded.raw_metadata,
      duration_seconds=coalesce(excluded.duration_seconds,source_videos.duration_seconds),
      updated_at=now()
    returning id into v_source_id;
  end if;

  if v_recipe_id is null and v_external_id is not null then
    select id into v_recipe_id
    from public.recipes
    where owner_id=v_owner
      and document->'source'->>'bvid'=v_external_id
      and coalesce(nullif(document->>'candidateKey',''),'main')=v_candidate_key
    order by created_at
    limit 1;
  end if;

  if v_recipe_id is null then
    v_recipe_id := 'manual-'||replace(v_owner::text,'-','')||'-'||
      coalesce(lower(v_external_id),'recipe-'||substr(replace(gen_random_uuid()::text,'-',''),1,12))||'-'||
      coalesce(nullif(trim(both '-' from regexp_replace(lower(v_candidate_key),'[^a-z0-9_-]+','-','g')),''),'main');
  end if;

  v_recipe_document := v_recipe || jsonb_strip_nulls(jsonb_build_object(
    'id',v_recipe_id,
    'candidateKey',v_candidate_key,
    'sourceVideoId',v_source_id,
    'contentReview',coalesce(v_recipe->'contentReview',v_review),
    'updatedAt',to_char(current_date,'YYYY-MM-DD')
  ));

  insert into public.recipes(id,owner_id,title,summary,status,visibility,total_minutes,document,deleted_at,updated_at)
  values(
    v_recipe_id,
    v_owner,
    trim(v_recipe->>'title'),
    coalesce(v_recipe->>'summary',''),
    coalesce(nullif(v_recipe->>'status',''),'inbox'),
    coalesce(nullif(v_recipe->>'visibility',''),'private'),
    coalesce(nullif(v_recipe->>'totalMinutes','')::integer,0),
    v_recipe_document,
    null,
    now()
  )
  on conflict(id) do update set
    title=excluded.title,
    summary=excluded.summary,
    status=excluded.status,
    visibility=excluded.visibility,
    total_minutes=excluded.total_minutes,
    document=excluded.document,
    deleted_at=null,
    updated_at=now()
  where recipes.owner_id=v_owner
  returning id into v_saved_recipe_id;

  if v_saved_recipe_id is null then raise exception 'recipe_id_conflict'; end if;

  perform 1 from public.recipes where id=v_recipe_id and owner_id=v_owner for update;
  select coalesce(max(version_no),0)+1 into v_version_no
  from public.recipe_versions
  where recipe_id=v_recipe_id;

  insert into public.recipe_versions(recipe_id,owner_id,version_no,version_type,change_note,document)
  values(
    v_recipe_id,
    v_owner,
    v_version_no,
    'source_extracted',
    coalesce(nullif(v_recipe->>'versionNote',''),'手动录入的来源整理版'),
    v_recipe_document
  )
  returning id into v_version_id;

  return jsonb_strip_nulls(jsonb_build_object(
    'recipeId',v_recipe_id,
    'sourceVideoId',v_source_id,
    'versionId',v_version_id,
    'versionNo',v_version_no
  ));
end $$;

revoke all on function public.save_manual_recipe(jsonb) from public;
grant execute on function public.save_manual_recipe(jsonb) to authenticated;
