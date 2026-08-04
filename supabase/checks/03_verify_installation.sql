-- Supabase SQL Editor 保存名称：03_检查数据库安装是否完整
-- 用途：只读检查。不会创建、修改或删除任何数据。

select
  to_regclass('public.recipes') is not null as recipes_table_ready,
  to_regclass('public.source_videos') is not null as source_videos_table_ready,
  to_regclass('public.import_jobs') is not null as import_jobs_table_ready,
  to_regclass('public.import_items') is not null as import_items_table_ready,
  to_regprocedure('public.import_bilibili_favorites(jsonb,text,text)') is not null as import_function_ready;
