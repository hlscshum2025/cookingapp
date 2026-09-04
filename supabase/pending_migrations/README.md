# 待发布迁移

这里的 SQL 尚未批准同步到 PROD，因此不会被 GitHub Supabase Integration 自动执行。

当前包括德国小票 OCR、核验商品、采购记录，以及物品识别与词典/粮仓桥接结构：

1. `20260822092846_receipt_ocr_schema.sql`
2. `20260822092944_receipt_ocr_fk_indexes.sql`
3. `20260827062435_inventory_recognition_contract.sql`

网页实际使用的异步上传队列已经通过 DEV 验证并进入活动 migration：

- `../migrations/20260904053238_async_ocr_queue.sql`
- `../migrations/20260904053245_ocr_queue_owner_index.sql`

它们已经按上述顺序应用到 DEV，但 PROD 尚未执行。发布前需要：

1. 在 DEV 应用并完成 RLS、外键和 Storage 私有访问测试；
2. 按 `docs/03_dev_prod_database_sync.md` 预览差异；
3. 明确发布批次和网页依赖；PWA 与菜谱本机队列不依赖这些表，不得顺带迁移；
4. 使用当前 Supabase CLI 创建正式迁移版本，移入 `../migrations/`；
5. 运行安全与性能 advisor 后再合入 `main`。
