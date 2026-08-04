-- Supabase SQL Editor 保存名称：04_检查云端写入结果
-- 用途：只读查看四张关键表的记录数和最近导入任务。
-- 运行前应先在 CookingApp 完成邮箱登录，并从导入中心导入前 10 条。

select 'import_items' as table_name, count(*) as row_count from public.import_items
union all select 'import_jobs', count(*) from public.import_jobs
union all select 'recipes', count(*) from public.recipes where deleted_at is null
union all select 'source_videos', count(*) from public.source_videos
order by table_name;

select
  id,
  file_name,
  status,
  counters,
  created_at,
  finished_at
from public.import_jobs
order by created_at desc
limit 10;
