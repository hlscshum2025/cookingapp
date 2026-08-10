-- CookingApp production-safe RLS privacy matrix.
--
-- Run as the database owner. All fixtures use unique IDs, are deleted before
-- commit, and the final query returns a compact PASS/FAIL summary. An
-- unexpected setup error aborts the transaction instead of leaving fixtures.

begin;

create temporary table rls_test_results (
  test_no integer primary key,
  category text not null,
  test_name text not null,
  passed boolean not null,
  actual text,
  details text
) on commit preserve rows;

create temporary table rls_test_context (
  key text primary key,
  value text not null
) on commit preserve rows;

grant select, insert on table pg_temp.rls_test_results to anon, authenticated;
grant select on table pg_temp.rls_test_context to anon, authenticated;

create function pg_temp.expect_count(
  p_test_no integer,
  p_category text,
  p_test_name text,
  p_sql text,
  p_expected bigint
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, pg_temp
as $$
declare
  v_actual bigint;
begin
  execute format('select count(*) from (%s) as rls_count_query', p_sql)
  into v_actual;

  insert into pg_temp.rls_test_results(test_no, category, test_name, passed, actual)
  values(p_test_no, p_category, p_test_name, v_actual = p_expected, v_actual::text);
exception when others then
  insert into pg_temp.rls_test_results(test_no, category, test_name, passed, details)
  values(p_test_no, p_category, p_test_name, false, sqlstate || ': ' || sqlerrm);
end;
$$;

create function pg_temp.expect_blocked(
  p_test_no integer,
  p_category text,
  p_test_name text,
  p_sql text
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, pg_temp
as $$
declare
  v_rows bigint;
begin
  execute p_sql;
  get diagnostics v_rows = row_count;

  insert into pg_temp.rls_test_results(test_no, category, test_name, passed, actual, details)
  values(
    p_test_no,
    p_category,
    p_test_name,
    v_rows = 0,
    v_rows::text,
    case when v_rows = 0 then null else 'statement changed rows' end
  );
exception when others then
  insert into pg_temp.rls_test_results(test_no, category, test_name, passed, actual)
  values(p_test_no, p_category, p_test_name, true, 'blocked: ' || sqlstate);
end;
$$;

create function pg_temp.expect_dml(
  p_test_no integer,
  p_category text,
  p_test_name text,
  p_sql text,
  p_expected_rows bigint
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, pg_temp
as $$
declare
  v_rows bigint;
begin
  execute p_sql;
  get diagnostics v_rows = row_count;

  insert into pg_temp.rls_test_results(test_no, category, test_name, passed, actual)
  values(p_test_no, p_category, p_test_name, v_rows = p_expected_rows, v_rows::text);
exception when others then
  insert into pg_temp.rls_test_results(test_no, category, test_name, passed, details)
  values(p_test_no, p_category, p_test_name, false, sqlstate || ': ' || sqlerrm);
end;
$$;

grant execute on function pg_temp.expect_count(integer, text, text, text, bigint)
to anon, authenticated;
grant execute on function pg_temp.expect_blocked(integer, text, text, text)
to anon, authenticated;
grant execute on function pg_temp.expect_dml(integer, text, text, text, bigint)
to anon, authenticated;

-- 1-10: every exposed business table has RLS enabled.
insert into pg_temp.rls_test_results(test_no, category, test_name, passed, actual)
select
  row_number() over (order by expected.table_name)::integer,
  'static_rls',
  expected.table_name || ' has RLS enabled',
  coalesce(cls.relrowsecurity, false),
  coalesce(cls.relrowsecurity, false)::text
from (
  values
    ('cooking_logs'),
    ('import_items'),
    ('import_jobs'),
    ('ingredients'),
    ('profiles'),
    ('recipe_tags'),
    ('recipe_versions'),
    ('recipes'),
    ('source_videos'),
    ('tags')
) as expected(table_name)
left join pg_catalog.pg_class cls on cls.relname = expected.table_name
left join pg_catalog.pg_namespace ns
  on ns.oid = cls.relnamespace and ns.nspname = 'public';

-- 11-20: owner policies run only for authenticated clients.
insert into pg_temp.rls_test_results(test_no, category, test_name, passed, actual, details)
select
  10 + row_number() over (order by expected.table_name)::integer,
  'static_policy_role',
  expected.table_name || ' owner policy targets authenticated',
  coalesce(p.roles = array['authenticated']::name[], false),
  coalesce(p.roles::text, 'missing'),
  case when p.policyname is null then 'owner policy is missing' end
from (
  values
    ('cooking_logs', 'logs owner'),
    ('import_items', 'import items owner'),
    ('import_jobs', 'import jobs owner'),
    ('ingredients', 'ingredients owner'),
    ('profiles', 'profiles own'),
    ('recipe_tags', 'recipe tags owner'),
    ('recipe_versions', 'versions owner'),
    ('recipes', 'recipes owner write'),
    ('source_videos', 'sources owner'),
    ('tags', 'tags owner')
) as expected(table_name, policy_name)
left join pg_catalog.pg_policies p
  on p.schemaname = 'public'
 and p.tablename = expected.table_name
 and p.policyname = expected.policy_name;

-- 21-33: no base-table public sharing, RPC grants are explicit, internal
-- trigger helpers stay non-callable, and Storage policies target auth users.
insert into pg_temp.rls_test_results values
  (21, 'static_public_boundary', 'recipes base table has no public read policy',
    not exists (
      select 1 from pg_catalog.pg_policies
      where schemaname = 'public'
        and tablename = 'recipes'
        and policyname = 'recipes public read'
    ), null, null),
  (22, 'static_rpc', 'anonymous cannot execute favorites import RPC',
    not pg_catalog.has_function_privilege(
      'anon', 'public.import_bilibili_favorites(jsonb,text,text)', 'execute'
    ), null, null),
  (23, 'static_rpc', 'anonymous cannot execute manual recipe RPC',
    not pg_catalog.has_function_privilege(
      'anon', 'public.save_manual_recipe(jsonb)', 'execute'
    ), null, null),
  (24, 'static_rpc', 'authenticated can execute favorites import RPC',
    pg_catalog.has_function_privilege(
      'authenticated', 'public.import_bilibili_favorites(jsonb,text,text)', 'execute'
    ), null, null),
  (25, 'static_rpc', 'authenticated can execute manual recipe RPC',
    pg_catalog.has_function_privilege(
      'authenticated', 'public.save_manual_recipe(jsonb)', 'execute'
    ), null, null),
  (26, 'static_trigger_rpc', 'anonymous cannot call handle_new_user',
    not pg_catalog.has_function_privilege('anon', 'public.handle_new_user()', 'execute'), null, null),
  (27, 'static_trigger_rpc', 'authenticated cannot call handle_new_user',
    not pg_catalog.has_function_privilege('authenticated', 'public.handle_new_user()', 'execute'), null, null),
  (28, 'static_trigger_rpc', 'anonymous cannot call snapshot_recipe_update',
    not pg_catalog.has_function_privilege('anon', 'public.snapshot_recipe_update()', 'execute'), null, null),
  (29, 'static_trigger_rpc', 'authenticated cannot call snapshot_recipe_update',
    not pg_catalog.has_function_privilege('authenticated', 'public.snapshot_recipe_update()', 'execute'), null, null);

insert into pg_temp.rls_test_results(test_no, category, test_name, passed, actual)
select
  29 + row_number() over (order by expected.policy_name)::integer,
  'static_storage',
  expected.policy_name || ' targets authenticated',
  coalesce(p.roles = array['authenticated']::name[], false),
  coalesce(p.roles::text, 'missing')
from (
  values
    ('recipe images owner delete'),
    ('recipe images owner insert'),
    ('recipe images owner read'),
    ('recipe images owner update')
) as expected(policy_name)
left join pg_catalog.pg_policies p
  on p.schemaname = 'storage'
 and p.tablename = 'objects'
 and p.policyname = expected.policy_name;

-- Isolated owner and attacker fixtures. The attacker auth row, every business
-- row is removed before this transaction ends. Storage policy checks never
-- create fake object rows because current Supabase versions protect direct
-- deletion from storage.objects; real object lifecycle tests use Storage API.
insert into pg_temp.rls_test_context(key, value)
values
  ('owner_id', (select id::text from auth.users order by created_at limit 1)),
  ('attacker_id', gen_random_uuid()::text),
  ('owner_recipe_id', 'rls-test-owner-' || replace(gen_random_uuid()::text, '-', '')),
  ('attacker_recipe_id', 'rls-test-attacker-' || replace(gen_random_uuid()::text, '-', '')),
  ('owner_version_id', gen_random_uuid()::text),
  ('attacker_version_id', gen_random_uuid()::text),
  ('owner_log_id', 'rls-test-owner-log-' || replace(gen_random_uuid()::text, '-', '')),
  ('attacker_log_id', 'rls-test-attacker-log-' || replace(gen_random_uuid()::text, '-', '')),
  ('owner_ingredient_id', 'rls-test-owner-ingredient-' || replace(gen_random_uuid()::text, '-', '')),
  ('attacker_ingredient_id', 'rls-test-attacker-ingredient-' || replace(gen_random_uuid()::text, '-', '')),
  ('owner_source_id', gen_random_uuid()::text),
  ('attacker_source_id', gen_random_uuid()::text),
  ('owner_job_id', gen_random_uuid()::text),
  ('attacker_job_id', gen_random_uuid()::text),
  ('owner_item_id', gen_random_uuid()::text),
  ('attacker_item_id', gen_random_uuid()::text),
  ('owner_tag_id', gen_random_uuid()::text),
  ('attacker_tag_id', gen_random_uuid()::text);

do $$
begin
  if (select value from pg_temp.rls_test_context where key = 'owner_id') is null then
    raise exception 'RLS matrix requires at least one existing auth user';
  end if;
end;
$$;

insert into auth.users(
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select
  value::uuid,
  'authenticated',
  'authenticated',
  'rls-test-' || value || '@invalid.example',
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"name":"RLS test attacker"}'::jsonb,
  now(),
  now()
from pg_temp.rls_test_context
where key = 'attacker_id';

insert into public.recipes(id, owner_id, title, document)
select
  (select value from pg_temp.rls_test_context where key = 'owner_recipe_id'),
  (select value::uuid from pg_temp.rls_test_context where key = 'owner_id'),
  'RLS owner fixture',
  '{"fixture":true}'::jsonb
union all
select
  (select value from pg_temp.rls_test_context where key = 'attacker_recipe_id'),
  (select value::uuid from pg_temp.rls_test_context where key = 'attacker_id'),
  'RLS attacker fixture',
  '{"fixture":true}'::jsonb;

insert into public.recipe_versions(id, recipe_id, owner_id, version_no, document)
select
  (select value::uuid from pg_temp.rls_test_context where key = 'owner_version_id'),
  (select value from pg_temp.rls_test_context where key = 'owner_recipe_id'),
  (select value::uuid from pg_temp.rls_test_context where key = 'owner_id'),
  1,
  '{"fixture":true}'::jsonb
union all
select
  (select value::uuid from pg_temp.rls_test_context where key = 'attacker_version_id'),
  (select value from pg_temp.rls_test_context where key = 'attacker_recipe_id'),
  (select value::uuid from pg_temp.rls_test_context where key = 'attacker_id'),
  1,
  '{"fixture":true}'::jsonb;

insert into public.cooking_logs(id, owner_id, recipe_id, rating, document)
select
  (select value from pg_temp.rls_test_context where key = 'owner_log_id'),
  (select value::uuid from pg_temp.rls_test_context where key = 'owner_id'),
  (select value from pg_temp.rls_test_context where key = 'owner_recipe_id'),
  5,
  '{"fixture":true}'::jsonb
union all
select
  (select value from pg_temp.rls_test_context where key = 'attacker_log_id'),
  (select value::uuid from pg_temp.rls_test_context where key = 'attacker_id'),
  (select value from pg_temp.rls_test_context where key = 'attacker_recipe_id'),
  5,
  '{"fixture":true}'::jsonb;

insert into public.ingredients(id, owner_id, canonical_name_zh, document)
select
  (select value from pg_temp.rls_test_context where key = 'owner_ingredient_id'),
  (select value::uuid from pg_temp.rls_test_context where key = 'owner_id'),
  'RLS owner ingredient ' || gen_random_uuid(),
  '{"fixture":true}'::jsonb
union all
select
  (select value from pg_temp.rls_test_context where key = 'attacker_ingredient_id'),
  (select value::uuid from pg_temp.rls_test_context where key = 'attacker_id'),
  'RLS attacker ingredient ' || gen_random_uuid(),
  '{"fixture":true}'::jsonb;

insert into public.source_videos(id, owner_id, external_id, url, raw_metadata)
select
  (select value::uuid from pg_temp.rls_test_context where key = 'owner_source_id'),
  (select value::uuid from pg_temp.rls_test_context where key = 'owner_id'),
  'RLS_OWNER_' || replace(gen_random_uuid()::text, '-', ''),
  'https://example.invalid/rls-owner',
  '{"fixture":true}'::jsonb
union all
select
  (select value::uuid from pg_temp.rls_test_context where key = 'attacker_source_id'),
  (select value::uuid from pg_temp.rls_test_context where key = 'attacker_id'),
  'RLS_ATTACKER_' || replace(gen_random_uuid()::text, '-', ''),
  'https://example.invalid/rls-attacker',
  '{"fixture":true}'::jsonb;

insert into public.import_jobs(id, owner_id, status)
select
  (select value::uuid from pg_temp.rls_test_context where key = 'owner_job_id'),
  (select value::uuid from pg_temp.rls_test_context where key = 'owner_id'),
  'pending'
union all
select
  (select value::uuid from pg_temp.rls_test_context where key = 'attacker_job_id'),
  (select value::uuid from pg_temp.rls_test_context where key = 'attacker_id'),
  'pending';

insert into public.import_items(
  id, owner_id, job_id, external_id, source_video_id, recipe_id
)
select
  (select value::uuid from pg_temp.rls_test_context where key = 'owner_item_id'),
  (select value::uuid from pg_temp.rls_test_context where key = 'owner_id'),
  (select value::uuid from pg_temp.rls_test_context where key = 'owner_job_id'),
  'RLS_OWNER_ITEM',
  (select value::uuid from pg_temp.rls_test_context where key = 'owner_source_id'),
  (select value from pg_temp.rls_test_context where key = 'owner_recipe_id')
union all
select
  (select value::uuid from pg_temp.rls_test_context where key = 'attacker_item_id'),
  (select value::uuid from pg_temp.rls_test_context where key = 'attacker_id'),
  (select value::uuid from pg_temp.rls_test_context where key = 'attacker_job_id'),
  'RLS_ATTACKER_ITEM',
  (select value::uuid from pg_temp.rls_test_context where key = 'attacker_source_id'),
  (select value from pg_temp.rls_test_context where key = 'attacker_recipe_id');

insert into public.tags(id, owner_id, group_name, slug, name)
select
  (select value::uuid from pg_temp.rls_test_context where key = 'owner_tag_id'),
  (select value::uuid from pg_temp.rls_test_context where key = 'owner_id'),
  'rls-test',
  'owner-' || replace(gen_random_uuid()::text, '-', ''),
  'RLS owner tag'
union all
select
  (select value::uuid from pg_temp.rls_test_context where key = 'attacker_tag_id'),
  (select value::uuid from pg_temp.rls_test_context where key = 'attacker_id'),
  'rls-test',
  'attacker-' || replace(gen_random_uuid()::text, '-', ''),
  'RLS attacker tag';

insert into public.recipe_tags(recipe_id, tag_id, owner_id)
select
  (select value from pg_temp.rls_test_context where key = 'owner_recipe_id'),
  (select value::uuid from pg_temp.rls_test_context where key = 'owner_tag_id'),
  (select value::uuid from pg_temp.rls_test_context where key = 'owner_id')
union all
select
  (select value from pg_temp.rls_test_context where key = 'attacker_recipe_id'),
  (select value::uuid from pg_temp.rls_test_context where key = 'attacker_tag_id'),
  (select value::uuid from pg_temp.rls_test_context where key = 'attacker_id');

-- 34-43: anonymous clients see no private rows.
set local role anon;
select set_config('request.jwt.claim.sub', '', true);

select pg_temp.expect_count(34, 'anon_read', 'anonymous cannot read owner profile',
  $sql$select * from public.profiles where id = (select value::uuid from pg_temp.rls_test_context where key='owner_id')$sql$, 0);
select pg_temp.expect_count(35, 'anon_read', 'anonymous cannot read private recipe',
  $sql$select * from public.recipes where id = (select value from pg_temp.rls_test_context where key='owner_recipe_id')$sql$, 0);
select pg_temp.expect_count(36, 'anon_read', 'anonymous cannot read recipe version',
  $sql$select * from public.recipe_versions where id = (select value::uuid from pg_temp.rls_test_context where key='owner_version_id')$sql$, 0);
select pg_temp.expect_count(37, 'anon_read', 'anonymous cannot read cooking log',
  $sql$select * from public.cooking_logs where id = (select value from pg_temp.rls_test_context where key='owner_log_id')$sql$, 0);
select pg_temp.expect_count(38, 'anon_read', 'anonymous cannot read ingredient',
  $sql$select * from public.ingredients where id = (select value from pg_temp.rls_test_context where key='owner_ingredient_id')$sql$, 0);
select pg_temp.expect_count(39, 'anon_read', 'anonymous cannot read source subtitle metadata',
  $sql$select * from public.source_videos where id = (select value::uuid from pg_temp.rls_test_context where key='owner_source_id')$sql$, 0);
select pg_temp.expect_count(40, 'anon_read', 'anonymous cannot read import job',
  $sql$select * from public.import_jobs where id = (select value::uuid from pg_temp.rls_test_context where key='owner_job_id')$sql$, 0);
select pg_temp.expect_count(41, 'anon_read', 'anonymous cannot read import item',
  $sql$select * from public.import_items where id = (select value::uuid from pg_temp.rls_test_context where key='owner_item_id')$sql$, 0);
select pg_temp.expect_count(42, 'anon_read', 'anonymous cannot read tag',
  $sql$select * from public.tags where id = (select value::uuid from pg_temp.rls_test_context where key='owner_tag_id')$sql$, 0);
select pg_temp.expect_count(43, 'anon_read', 'anonymous cannot read recipe-tag link',
  $sql$select * from public.recipe_tags where recipe_id = (select value from pg_temp.rls_test_context where key='owner_recipe_id')$sql$, 0);

reset role;

-- 44-115: a real second auth identity can use its own rows but cannot read,
-- associate with, modify, delete, or take ownership of the first user's rows.
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  (select value from pg_temp.rls_test_context where key = 'attacker_id'),
  true
);

select pg_temp.expect_count(44, 'cross_user_read', 'attacker cannot read owner profile',
  $sql$select * from public.profiles where id = (select value::uuid from pg_temp.rls_test_context where key='owner_id')$sql$, 0);
select pg_temp.expect_count(45, 'cross_user_read', 'attacker cannot read owner recipe',
  $sql$select * from public.recipes where id = (select value from pg_temp.rls_test_context where key='owner_recipe_id')$sql$, 0);
select pg_temp.expect_count(46, 'cross_user_read', 'attacker cannot read owner recipe version',
  $sql$select * from public.recipe_versions where id = (select value::uuid from pg_temp.rls_test_context where key='owner_version_id')$sql$, 0);
select pg_temp.expect_count(47, 'cross_user_read', 'attacker cannot read owner cooking log',
  $sql$select * from public.cooking_logs where id = (select value from pg_temp.rls_test_context where key='owner_log_id')$sql$, 0);
select pg_temp.expect_count(48, 'cross_user_read', 'attacker cannot read owner ingredient',
  $sql$select * from public.ingredients where id = (select value from pg_temp.rls_test_context where key='owner_ingredient_id')$sql$, 0);
select pg_temp.expect_count(49, 'cross_user_read', 'attacker cannot read owner source video',
  $sql$select * from public.source_videos where id = (select value::uuid from pg_temp.rls_test_context where key='owner_source_id')$sql$, 0);
select pg_temp.expect_count(50, 'cross_user_read', 'attacker cannot read owner import job',
  $sql$select * from public.import_jobs where id = (select value::uuid from pg_temp.rls_test_context where key='owner_job_id')$sql$, 0);
select pg_temp.expect_count(51, 'cross_user_read', 'attacker cannot read owner import item',
  $sql$select * from public.import_items where id = (select value::uuid from pg_temp.rls_test_context where key='owner_item_id')$sql$, 0);
select pg_temp.expect_count(52, 'cross_user_read', 'attacker cannot read owner tag',
  $sql$select * from public.tags where id = (select value::uuid from pg_temp.rls_test_context where key='owner_tag_id')$sql$, 0);
select pg_temp.expect_count(53, 'cross_user_read', 'attacker cannot read owner recipe-tag link',
  $sql$select * from public.recipe_tags where recipe_id = (select value from pg_temp.rls_test_context where key='owner_recipe_id')$sql$, 0);

select pg_temp.expect_blocked(54, 'cross_user_association', 'version cannot reference another user recipe',
  $sql$insert into public.recipe_versions(recipe_id,owner_id,version_no,document) values ((select value from pg_temp.rls_test_context where key='owner_recipe_id'),(select value::uuid from pg_temp.rls_test_context where key='attacker_id'),9901,'{}')$sql$);
select pg_temp.expect_blocked(55, 'cross_user_association', 'log cannot reference another user recipe',
  $sql$insert into public.cooking_logs(id,owner_id,recipe_id,document) values ('rls-test-cross-log',(select value::uuid from pg_temp.rls_test_context where key='attacker_id'),(select value from pg_temp.rls_test_context where key='owner_recipe_id'),'{}')$sql$);
select pg_temp.expect_blocked(56, 'cross_user_association', 'import item cannot reference another user job',
  $sql$insert into public.import_items(owner_id,job_id,external_id) values ((select value::uuid from pg_temp.rls_test_context where key='attacker_id'),(select value::uuid from pg_temp.rls_test_context where key='owner_job_id'),'RLS_CROSS_JOB')$sql$);
select pg_temp.expect_blocked(57, 'cross_user_association', 'import item cannot reference another user source',
  $sql$insert into public.import_items(owner_id,job_id,external_id,source_video_id) values ((select value::uuid from pg_temp.rls_test_context where key='attacker_id'),(select value::uuid from pg_temp.rls_test_context where key='attacker_job_id'),'RLS_CROSS_SOURCE',(select value::uuid from pg_temp.rls_test_context where key='owner_source_id'))$sql$);
select pg_temp.expect_blocked(58, 'cross_user_association', 'import item cannot reference another user recipe',
  $sql$insert into public.import_items(owner_id,job_id,external_id,recipe_id) values ((select value::uuid from pg_temp.rls_test_context where key='attacker_id'),(select value::uuid from pg_temp.rls_test_context where key='attacker_job_id'),'RLS_CROSS_RECIPE',(select value from pg_temp.rls_test_context where key='owner_recipe_id'))$sql$);
select pg_temp.expect_blocked(59, 'cross_user_association', 'recipe-tag cannot reference another user recipe',
  $sql$insert into public.recipe_tags(recipe_id,tag_id,owner_id) values ((select value from pg_temp.rls_test_context where key='owner_recipe_id'),(select value::uuid from pg_temp.rls_test_context where key='attacker_tag_id'),(select value::uuid from pg_temp.rls_test_context where key='attacker_id'))$sql$);
select pg_temp.expect_blocked(60, 'cross_user_association', 'recipe-tag cannot reference another user tag',
  $sql$insert into public.recipe_tags(recipe_id,tag_id,owner_id) values ((select value from pg_temp.rls_test_context where key='attacker_recipe_id'),(select value::uuid from pg_temp.rls_test_context where key='owner_tag_id'),(select value::uuid from pg_temp.rls_test_context where key='attacker_id'))$sql$);

select pg_temp.expect_count(61, 'own_read', 'attacker can read own profile',
  $sql$select * from public.profiles where id = (select value::uuid from pg_temp.rls_test_context where key='attacker_id')$sql$, 1);
select pg_temp.expect_count(62, 'own_read', 'attacker can read own recipe',
  $sql$select * from public.recipes where id = (select value from pg_temp.rls_test_context where key='attacker_recipe_id')$sql$, 1);
select pg_temp.expect_count(63, 'own_read', 'attacker can read own recipe version',
  $sql$select * from public.recipe_versions where id = (select value::uuid from pg_temp.rls_test_context where key='attacker_version_id')$sql$, 1);
select pg_temp.expect_count(64, 'own_read', 'attacker can read own cooking log',
  $sql$select * from public.cooking_logs where id = (select value from pg_temp.rls_test_context where key='attacker_log_id')$sql$, 1);
select pg_temp.expect_count(65, 'own_read', 'attacker can read own ingredient',
  $sql$select * from public.ingredients where id = (select value from pg_temp.rls_test_context where key='attacker_ingredient_id')$sql$, 1);
select pg_temp.expect_count(66, 'own_read', 'attacker can read own source video',
  $sql$select * from public.source_videos where id = (select value::uuid from pg_temp.rls_test_context where key='attacker_source_id')$sql$, 1);
select pg_temp.expect_count(67, 'own_read', 'attacker can read own import job',
  $sql$select * from public.import_jobs where id = (select value::uuid from pg_temp.rls_test_context where key='attacker_job_id')$sql$, 1);
select pg_temp.expect_count(68, 'own_read', 'attacker can read own import item',
  $sql$select * from public.import_items where id = (select value::uuid from pg_temp.rls_test_context where key='attacker_item_id')$sql$, 1);
select pg_temp.expect_count(69, 'own_read', 'attacker can read own tag',
  $sql$select * from public.tags where id = (select value::uuid from pg_temp.rls_test_context where key='attacker_tag_id')$sql$, 1);
select pg_temp.expect_count(70, 'own_read', 'attacker can read own recipe-tag link',
  $sql$select * from public.recipe_tags where recipe_id = (select value from pg_temp.rls_test_context where key='attacker_recipe_id')$sql$, 1);

select pg_temp.expect_dml(71, 'own_update', 'attacker can update own profile',
  $sql$update public.profiles set display_name='RLS own update' where id=(select value::uuid from pg_temp.rls_test_context where key='attacker_id')$sql$, 1);
select pg_temp.expect_dml(72, 'own_update', 'attacker can update own recipe',
  $sql$update public.recipes set title='RLS own update' where id=(select value from pg_temp.rls_test_context where key='attacker_recipe_id')$sql$, 1);
select pg_temp.expect_dml(73, 'own_update', 'attacker can update own recipe version',
  $sql$update public.recipe_versions set change_note='RLS own update' where id=(select value::uuid from pg_temp.rls_test_context where key='attacker_version_id')$sql$, 1);
select pg_temp.expect_dml(74, 'own_update', 'attacker can update own cooking log',
  $sql$update public.cooking_logs set rating=4 where id=(select value from pg_temp.rls_test_context where key='attacker_log_id')$sql$, 1);
select pg_temp.expect_dml(75, 'own_update', 'attacker can update own ingredient',
  $sql$update public.ingredients set category='RLS own update' where id=(select value from pg_temp.rls_test_context where key='attacker_ingredient_id')$sql$, 1);
select pg_temp.expect_dml(76, 'own_update', 'attacker can update own source video',
  $sql$update public.source_videos set title='RLS own update' where id=(select value::uuid from pg_temp.rls_test_context where key='attacker_source_id')$sql$, 1);
select pg_temp.expect_dml(77, 'own_update', 'attacker can update own import job',
  $sql$update public.import_jobs set status='processing' where id=(select value::uuid from pg_temp.rls_test_context where key='attacker_job_id')$sql$, 1);
select pg_temp.expect_dml(78, 'own_update', 'attacker can update own import item',
  $sql$update public.import_items set status='processed' where id=(select value::uuid from pg_temp.rls_test_context where key='attacker_item_id')$sql$, 1);
select pg_temp.expect_dml(79, 'own_update', 'attacker can update own tag',
  $sql$update public.tags set name='RLS own update' where id=(select value::uuid from pg_temp.rls_test_context where key='attacker_tag_id')$sql$, 1);
select pg_temp.expect_dml(80, 'own_update', 'attacker can update own recipe-tag link',
  $sql$update public.recipe_tags set confirmed=false where recipe_id=(select value from pg_temp.rls_test_context where key='attacker_recipe_id') and tag_id=(select value::uuid from pg_temp.rls_test_context where key='attacker_tag_id')$sql$, 1);

select pg_temp.expect_blocked(81, 'owner_tamper', 'recipe owner_id cannot be reassigned',
  $sql$update public.recipes set owner_id=(select value::uuid from pg_temp.rls_test_context where key='owner_id') where id=(select value from pg_temp.rls_test_context where key='attacker_recipe_id')$sql$);
select pg_temp.expect_blocked(82, 'owner_tamper', 'recipe version owner_id cannot be reassigned',
  $sql$update public.recipe_versions set owner_id=(select value::uuid from pg_temp.rls_test_context where key='owner_id') where id=(select value::uuid from pg_temp.rls_test_context where key='attacker_version_id')$sql$);
select pg_temp.expect_blocked(83, 'owner_tamper', 'cooking log owner_id cannot be reassigned',
  $sql$update public.cooking_logs set owner_id=(select value::uuid from pg_temp.rls_test_context where key='owner_id') where id=(select value from pg_temp.rls_test_context where key='attacker_log_id')$sql$);
select pg_temp.expect_blocked(84, 'owner_tamper', 'ingredient owner_id cannot be reassigned',
  $sql$update public.ingredients set owner_id=(select value::uuid from pg_temp.rls_test_context where key='owner_id') where id=(select value from pg_temp.rls_test_context where key='attacker_ingredient_id')$sql$);
select pg_temp.expect_blocked(85, 'owner_tamper', 'source owner_id cannot be reassigned',
  $sql$update public.source_videos set owner_id=(select value::uuid from pg_temp.rls_test_context where key='owner_id') where id=(select value::uuid from pg_temp.rls_test_context where key='attacker_source_id')$sql$);
select pg_temp.expect_blocked(86, 'owner_tamper', 'import job owner_id cannot be reassigned',
  $sql$update public.import_jobs set owner_id=(select value::uuid from pg_temp.rls_test_context where key='owner_id') where id=(select value::uuid from pg_temp.rls_test_context where key='attacker_job_id')$sql$);
select pg_temp.expect_blocked(87, 'owner_tamper', 'import item owner_id cannot be reassigned',
  $sql$update public.import_items set owner_id=(select value::uuid from pg_temp.rls_test_context where key='owner_id') where id=(select value::uuid from pg_temp.rls_test_context where key='attacker_item_id')$sql$);
select pg_temp.expect_blocked(88, 'owner_tamper', 'tag owner_id cannot be reassigned',
  $sql$update public.tags set owner_id=(select value::uuid from pg_temp.rls_test_context where key='owner_id') where id=(select value::uuid from pg_temp.rls_test_context where key='attacker_tag_id')$sql$);
select pg_temp.expect_blocked(89, 'owner_tamper', 'recipe-tag owner_id cannot be reassigned',
  $sql$update public.recipe_tags set owner_id=(select value::uuid from pg_temp.rls_test_context where key='owner_id') where recipe_id=(select value from pg_temp.rls_test_context where key='attacker_recipe_id') and tag_id=(select value::uuid from pg_temp.rls_test_context where key='attacker_tag_id')$sql$);

select pg_temp.expect_count(90, 'storage', 'attacker cannot read owner image metadata',
  $sql$select * from storage.objects where name=(select value from pg_temp.rls_test_context where key='owner_id')||'/rls-test-owner.jpg'$sql$, 0);
select pg_temp.expect_blocked(91, 'storage', 'attacker cannot insert into owner image folder',
  $sql$insert into storage.objects(bucket_id,name,owner,owner_id) values ('recipe-images',(select value from pg_temp.rls_test_context where key='owner_id')||'/rls-test-cross.jpg',(select value::uuid from pg_temp.rls_test_context where key='attacker_id'),(select value from pg_temp.rls_test_context where key='attacker_id'))$sql$);
select pg_temp.expect_blocked(92, 'storage', 'attacker cannot update owner image metadata',
  $sql$update storage.objects set metadata='{"tampered":true}' where name=(select value from pg_temp.rls_test_context where key='owner_id')||'/rls-test-owner.jpg'$sql$);
select pg_temp.expect_blocked(93, 'storage', 'attacker cannot delete owner image metadata',
  $sql$delete from storage.objects where name=(select value from pg_temp.rls_test_context where key='owner_id')||'/rls-test-owner.jpg'$sql$);

select pg_temp.expect_blocked(94, 'cross_user_update', 'attacker cannot update owner profile',
  $sql$update public.profiles set display_name='tampered' where id=(select value::uuid from pg_temp.rls_test_context where key='owner_id')$sql$);
select pg_temp.expect_blocked(95, 'cross_user_update', 'attacker cannot update owner recipe',
  $sql$update public.recipes set title='tampered' where id=(select value from pg_temp.rls_test_context where key='owner_recipe_id')$sql$);
select pg_temp.expect_blocked(96, 'cross_user_update', 'attacker cannot update owner recipe version',
  $sql$update public.recipe_versions set change_note='tampered' where id=(select value::uuid from pg_temp.rls_test_context where key='owner_version_id')$sql$);
select pg_temp.expect_blocked(97, 'cross_user_update', 'attacker cannot update owner cooking log',
  $sql$update public.cooking_logs set rating=1 where id=(select value from pg_temp.rls_test_context where key='owner_log_id')$sql$);
select pg_temp.expect_blocked(98, 'cross_user_update', 'attacker cannot update owner ingredient',
  $sql$update public.ingredients set category='tampered' where id=(select value from pg_temp.rls_test_context where key='owner_ingredient_id')$sql$);
select pg_temp.expect_blocked(99, 'cross_user_update', 'attacker cannot update owner source video',
  $sql$update public.source_videos set title='tampered' where id=(select value::uuid from pg_temp.rls_test_context where key='owner_source_id')$sql$);
select pg_temp.expect_blocked(100, 'cross_user_update', 'attacker cannot update owner import job',
  $sql$update public.import_jobs set status='failed' where id=(select value::uuid from pg_temp.rls_test_context where key='owner_job_id')$sql$);
select pg_temp.expect_blocked(101, 'cross_user_update', 'attacker cannot update owner import item',
  $sql$update public.import_items set status='failed' where id=(select value::uuid from pg_temp.rls_test_context where key='owner_item_id')$sql$);
select pg_temp.expect_blocked(102, 'cross_user_update', 'attacker cannot update owner tag',
  $sql$update public.tags set name='tampered' where id=(select value::uuid from pg_temp.rls_test_context where key='owner_tag_id')$sql$);
select pg_temp.expect_blocked(103, 'cross_user_update', 'attacker cannot update owner recipe-tag link',
  $sql$update public.recipe_tags set confirmed=false where recipe_id=(select value from pg_temp.rls_test_context where key='owner_recipe_id') and tag_id=(select value::uuid from pg_temp.rls_test_context where key='owner_tag_id')$sql$);

select pg_temp.expect_blocked(104, 'cross_user_delete', 'attacker cannot delete owner profile',
  $sql$delete from public.profiles where id=(select value::uuid from pg_temp.rls_test_context where key='owner_id')$sql$);
select pg_temp.expect_blocked(105, 'cross_user_delete', 'attacker cannot delete owner recipe',
  $sql$delete from public.recipes where id=(select value from pg_temp.rls_test_context where key='owner_recipe_id')$sql$);
select pg_temp.expect_blocked(106, 'cross_user_delete', 'attacker cannot delete owner recipe version',
  $sql$delete from public.recipe_versions where id=(select value::uuid from pg_temp.rls_test_context where key='owner_version_id')$sql$);
select pg_temp.expect_blocked(107, 'cross_user_delete', 'attacker cannot delete owner cooking log',
  $sql$delete from public.cooking_logs where id=(select value from pg_temp.rls_test_context where key='owner_log_id')$sql$);
select pg_temp.expect_blocked(108, 'cross_user_delete', 'attacker cannot delete owner ingredient',
  $sql$delete from public.ingredients where id=(select value from pg_temp.rls_test_context where key='owner_ingredient_id')$sql$);
select pg_temp.expect_blocked(109, 'cross_user_delete', 'attacker cannot delete owner source video',
  $sql$delete from public.source_videos where id=(select value::uuid from pg_temp.rls_test_context where key='owner_source_id')$sql$);
select pg_temp.expect_blocked(110, 'cross_user_delete', 'attacker cannot delete owner import job',
  $sql$delete from public.import_jobs where id=(select value::uuid from pg_temp.rls_test_context where key='owner_job_id')$sql$);
select pg_temp.expect_blocked(111, 'cross_user_delete', 'attacker cannot delete owner import item',
  $sql$delete from public.import_items where id=(select value::uuid from pg_temp.rls_test_context where key='owner_item_id')$sql$);
select pg_temp.expect_blocked(112, 'cross_user_delete', 'attacker cannot delete owner tag',
  $sql$delete from public.tags where id=(select value::uuid from pg_temp.rls_test_context where key='owner_tag_id')$sql$);
select pg_temp.expect_blocked(113, 'cross_user_delete', 'attacker cannot delete owner recipe-tag link',
  $sql$delete from public.recipe_tags where recipe_id=(select value from pg_temp.rls_test_context where key='owner_recipe_id') and tag_id=(select value::uuid from pg_temp.rls_test_context where key='owner_tag_id')$sql$);

select pg_temp.expect_count(114, 'rpc_regression', 'authenticated favorites import RPC still works',
  $sql$select public.import_bilibili_favorites('[]'::jsonb, null, 'rls-test.json')$sql$, 1);
select pg_temp.expect_count(115, 'rpc_regression', 'authenticated manual recipe RPC still works',
  $sql$select public.save_manual_recipe('{"recipe":{"title":"RLS RPC fixture","candidateKey":"rpc","status":"inbox","visibility":"private","totalMinutes":0}}'::jsonb)$sql$, 1);

reset role;
select set_config('request.jwt.claim.sub', '', true);

-- Cleanup is explicit so successful negative tests can never leave fixtures.
delete from public.recipes
where id in (
  (select value from pg_temp.rls_test_context where key='owner_recipe_id'),
  (select value from pg_temp.rls_test_context where key='attacker_recipe_id')
);
delete from public.import_jobs
where id in (
  (select value::uuid from pg_temp.rls_test_context where key='owner_job_id'),
  (select value::uuid from pg_temp.rls_test_context where key='attacker_job_id')
);
delete from public.source_videos
where id in (
  (select value::uuid from pg_temp.rls_test_context where key='owner_source_id'),
  (select value::uuid from pg_temp.rls_test_context where key='attacker_source_id')
);
delete from public.ingredients
where id in (
  (select value from pg_temp.rls_test_context where key='owner_ingredient_id'),
  (select value from pg_temp.rls_test_context where key='attacker_ingredient_id')
);
delete from public.tags
where id in (
  (select value::uuid from pg_temp.rls_test_context where key='owner_tag_id'),
  (select value::uuid from pg_temp.rls_test_context where key='attacker_tag_id')
);
delete from auth.users
where id = (select value::uuid from pg_temp.rls_test_context where key='attacker_id');

commit;

select jsonb_build_object(
  'total', count(*),
  'passed', count(*) filter (where passed),
  'failed', count(*) filter (where not passed),
  'failures', coalesce(
    jsonb_agg(
      jsonb_build_object(
        'testNo', test_no,
        'category', category,
        'name', test_name,
        'actual', actual,
        'details', details
      ) order by test_no
    ) filter (where not passed),
    '[]'::jsonb
  )
) as rls_matrix_result
from pg_temp.rls_test_results;
