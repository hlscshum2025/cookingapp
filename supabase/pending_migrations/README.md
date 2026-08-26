# 待发布迁移

这里的 SQL 尚未批准同步到 PROD，因此不会被 GitHub Supabase Integration 自动执行。

当前包括德国小票 OCR、核验商品和采购记录结构。发布前需要：

1. 在 DEV 应用并完成 RLS、外键和 Storage 私有访问测试；
2. 按 `docs/03_dev_prod_database_sync.md` 预览差异；
3. 明确发布批次；
4. 使用当前 Supabase CLI 创建正式迁移版本，移入 `../migrations/`；
5. 运行安全与性能 advisor 后再合入 `main`。
