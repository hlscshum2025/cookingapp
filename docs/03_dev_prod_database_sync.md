# 03 DEV / PROD 数据库差异与发布前同步记录

> 用途：这是 CookingApp 发布前的数据库结构检查入口。任何先在 DEV（`cookingapp test`）验证、尚未同步到 PROD（`cookingapp`）的数据库结构变化，都必须先记录在这里。Work / 发布聊天在发布 Sites 前应先读取本文档，把所有 `待同步` 项应用到 PROD 并验证，再发布网页。

## 环境

| 环境 | Supabase 项目 | Project Ref | 用途 |
|---|---|---|---|
| DEV | `cookingapp test` | `dhheqxsxzypmwudhkfuu` | 开发、DDL/RLS 验证、测试数据 |
| PROD | `cookingapp` | `qynbhlaumtlxtypabjdq` | 正式用户和正式业务数据 |

## 强制规则

1. 新表、字段、索引、约束、RLS Policy、Trigger、Function 等结构修改，优先在 DEV 验证。
2. DEV 验证通过后：
   - 在 GitHub `supabase/migrations/` 保存对应 migration；
   - 在本文档新增一条差异记录，并标记为 `待同步 PROD`；
   - 不因为网页代码已进入 `main` 就默认 PROD 数据库已更新。
3. 发布 Sites 前，Work / 发布聊天必须：
   - 读取本文档；
   - 将所有 `待同步 PROD` 项同步到 PROD；
   - 验证表/字段/RLS/索引/约束/Trigger/Function；
   - 将记录改为 `已同步`；
   - 最后才发布网页。
4. **结构同步和业务数据迁移是两件事。** 不允许用 DEV 整库覆盖 PROD；Auth UUID、正式用户数据、Storage 文件必须独立处理。
5. PROD 已存在而 DEV 缺失的结构也必须反向补到 DEV，避免双向漂移。
6. DEV → PROD 业务数据迁移必须先 dry-run；已有 PROD 记录默认保留，不用 DEV 较旧数据覆盖正式数据。
7. **仅处于产品/数据库设计阶段的结构，不算 DEV / PROD 差异。** 先记录在“计划结构变化”中；只有 migration 真正在 DEV 执行后，才移动到“待同步 PROD”。

## 当前结构状态

**2026-08-22：已发布功能的 DEV / PROD 结构此前保持对齐；本次按计划只在 DEV 建立小票 OCR 数据基座，因此现在存在一组有意保留的 `待同步 PROD` 差异。DEV 当前为 `ACTIVE_HEALTHY`，本次未修改 PROD。**

已核对范围：

- `public` 业务表
- 字段定义与默认值
- RLS Policies
- Indexes
- Primary / Foreign / Unique / Check constraints
- Triggers
- `public` / `private` 业务 Functions（忽略纯换行格式差异后比对）

> 注：两个项目历史上存在直接执行 SQL 的情况，因此 `supabase_migrations.schema_migrations` 的时间戳/历史记录并不完全一致；发布判断应以 GitHub migration + 实际对象验证为准，后续逐步收敛为 migration-only 流程。

## DEV / PROD 差异与同步日志

| 日期 | 结构变化 | GitHub migration | DEV | PROD | 当前状态 | 备注 |
|---|---|---|---|---|---|---|
| 2026-08-11 | 补齐常用 owner / FK 查询索引：`cooking_logs_owner_cooked_idx`、`import_items_owner_idx`、`import_items_recipe_idx`、`import_items_source_video_idx`、`recipe_tags_owner_idx`、`recipe_tags_tag_idx`、`recipe_versions_owner_idx` | `20260811112654_add_missing_foreign_key_indexes.sql` | 2026-08-14 补齐 | 原已存在 | **已同步** | 之前出现 PROD 有、DEV 缺失的反向漂移；现已一致 |
| 2026-08-13 | 公开菜谱点赞：`public_recipes.like_count`、`public_recipe_likes`、RLS、计数 Trigger / private Function | `202608130001_public_recipe_likes.sql` | 已验证 | 2026-08-14 补齐 | **已同步** | 网页点赞功能依赖此结构；未同步时不可发布对应前端 |
| 2026-08-14 | 线上冰箱：`pantry_items`、owner-only RLS、账号级库存 | `202608130002_pantry_items.sql` | 已存在并验证 | 已存在并验证 | **已同步** | 业务数据独立；结构一致不代表库存数据相同 |
| 2026-08-22 | “我的粮仓”分区：为 `pantry_items` 增加 `storage_location`、冰箱/储物柜约束及 owner/location 查询索引 | `202608220001_pantry_storage_location.sql` | 已执行并验证 | 已执行并验证 | **已同步** | 旧数据默认归入 `fridge`；未复制或覆盖业务数据 |
| 2026-08-22 | 用户反馈队列：`feedback_submissions`、owner/admin RLS、队列和外键索引 | `202608220001_feedback_submissions.sql` | 已执行并验证 | 已执行并验证 | **已同步** | 登录用户只能读自己的反馈并提交 `new/P3`；管理员可读全体并更新；anon 无权限 |
| 2026-08-22 | 小票 OCR 数据基座：5 张 owner-only 表、复合 owner 外键、查询索引、私有 `receipt-images` bucket 与 Storage RLS | `202608220002_receipt_ocr_schema.sql` + `202608220003_receipt_ocr_fk_indexes.sql` | 已执行并验证 | 未执行 | **待同步 PROD** | 当前没有前端写入依赖；必须等用户本地检查并明确要求发布后再同步 |

## 2026-08-14 DEV → PROD 增量业务数据合并

本次不是整库覆盖，而是按正式账号重新映射所有权后进行增量插入。

### Dry-run 规则

- DEV / PROD 账号按 email 对应，`owner_id` 使用 PROD Auth UUID；不复制 DEV Auth UUID。
- `source_videos` 按 PROD 唯一约束去重；已有来源不更新。
- 已存在的正式菜谱（例如已经在 PROD 编辑过的菜谱）以 PROD 为准，不用 DEV 较旧版本覆盖。
- 只迁移 PROD 当前不存在的新菜谱及其版本。
- 新导入批次与明细保留原业务关联；所有 recipe/source/job FK 在写入后复核。
- 不迁移 Storage 二进制图片；本次新增数据不依赖新增 Storage 文件。

### 实际结果

| 对象 | 新增到 PROD | 处理说明 |
|---|---:|---|
| `source_videos` | 190 | 11 条 PROD 已有来源自动跳过；合并后主账号共有 201 条来源 |
| `import_jobs` | 1 | 合并后主账号共有 5 个导入批次 |
| `import_items` | 199 | 合并后主账号共有 239 条导入明细 |
| `recipes` | 1 | 新增“雪碧黄瓜”；已有正式菜谱未覆盖 |
| `recipe_versions` | 4 | 仅新增“雪碧黄瓜”的 4 个历史版本 |
| `cooking_logs` | 0 | DEV 中旧日志在 PROD 已存在，因此跳过 |

合并后回读结果：

- 主账号：8 道菜、201 条来源、5 个导入批次、239 条导入明细、17 个菜谱版本、2 条做菜日志。
- 另外三个 PROD 用户的业务数据数量未发生变化。
- `import_items → recipes` 断链：0。
- `import_items → source_videos` 断链：0。
- `import_items → import_jobs` 断链：0。
- “雪碧黄瓜”的 recipe ID 和 `document.id` 已重映射为 PROD 账号命名空间，且保留 4 个版本。
- 临时 DEV 导出 / PROD 导入 Edge Function 已覆盖为 `410 retired` 且重新启用 JWT 验证。
- 为迁移临时启用的 PROD `http` extension 已删除，没有作为永久数据库依赖保留。

## V2 小票 OCR / 采购成本：DEV 已实施结构（待同步 PROD）

> 2026-08-18 完成设计，2026-08-22 已生成 migration 并只在 DEV 执行。当前属于真实 DEV / PROD 差异；PROD 仍不做任何变化，直到用户本地检查并明确要求发布。

目标数据流：

```text
小票原图
  ↓
OCR run（PaddleOCR / Apple Vision / ML Kit 等）
  ↓
原始小票行 + bbox + confidence
  ↓
厨房词典 / 德国商品别名 → canonical ingredient_id
  ↓
用户确认
  ↓
purchase_records
  ├─ 成本核算
  └─ 可选加入 pantry_items
```

### 计划表

| 已实施对象 | 关键字段 | 目的 | DEV 验证 / 发布要求 |
|---|---|---|---|
| `shopping_receipts` | 商店、国家、日期、币种、总价、私有 `image_path`、状态 | 一张小票的业务入口；原图放入 `receipt-images/<owner_id>/...` | RLS + grants 已验证；anon 无权限 |
| `receipt_ocr_runs` | receipt/owner、provider、model/preprocess version、状态、raw text/result、耗时/错误 | 同一张小票允许比较多次或多 provider 识别，不覆盖历史 | owner 复合外键、4 条 owner policy 已验证 |
| `shopping_receipt_items` | 原始行/商品名、canonical key、数量/包装/价格、bbox、confidence、核验状态 | 保存 OCR 候选商品行；未知字段允许为空 | `unverified` 不能自动进入成本/库存；owner 复合外键已验证 |
| `purchase_records` | canonical key、来源候选行、商店/日期/币种、数量/包装/总价、核验状态 | 统一采购事实，可来自小票或未来手工录入 | 成本与库存只能消费 `user_verified`；owner-only |
| `ingredient_market_aliases` | owner、canonical key、国家、locale、商店、alias/normalized alias、来源/核验 | 把 `KARTOFFELN`、商店缩写等映射到稳定词典 id | V2 先 owner-only；公共共享与管理员维护留到词典提案审核设计 |

### 设计约束

- 不为简中、繁中、英文、德文复制四个 ingredient；仍以稳定 `ingredient_id` 为核心，显示名称/alias 按 locale 映射。
- OCR provider 不写死成单一实现，至少预留 `paddleocr`、`apple_vision`、`mlkit`、`manual`。
- `raw_result` 用于调试和研究，正式采购事实必须落在显式字段，避免业务逻辑依赖某个 OCR 厂商 JSON 格式。
- 数量、单位、价格允许空值；OCR 猜不出的字段不能伪造。
- `verification_status` 至少区分 `unverified`、`user_verified`、`rejected`；只有确认后的记录才能进入成本或库存自动化。
- 小票可能包含支付、交易或会员信息；公开分享 API 永不返回小票原图、`raw_result` 或非必要交易字段。
- 已使用两个独立 migration 在 DEV 执行，并核对 5 表 RLS、每表 4 条 owner policy、anon 无读取、authenticated 最小表权限、4 个复合 owner 外键、覆盖索引及 4 条 Storage policy。

## 发布前给 Work / 发布聊天的固定检查单

发布聊天应按以下顺序执行：

- [ ] 读取 `docs/03_dev_prod_database_sync.md`
- [ ] 确认没有 `待同步 PROD` 项
- [ ] 若有：先将对应 migration 应用到 PROD
- [ ] 验证 PROD RLS 和权限，不使用 `service_role` 暴露给前端
- [ ] 对 DEV / PROD 做结构签名/对象清单复核
- [ ] 确认网页 `main` 所依赖的数据库字段/表均已存在于 PROD
- [ ] 再发布 Sites
- [ ] 发布后做登录、读取、写入、越权隔离和关键页面冒烟测试

## 业务数据迁移说明

DEV → PROD 的测试数据合并不得通过整库覆盖完成。推荐规则：

- Auth 用户按 **email 找到对应 PROD 用户**，再映射 `owner_id` / `profiles.id`；
- `source_videos` 按 `(owner, platform, external_id)` 去重；
- 其他 FK 在迁移时映射到 PROD 中实际存在的目标记录；
- PROD 中 DEV 不存在的用户和业务数据不得删除或覆盖；
- Storage 图片文件不包含在普通数据库行迁移中，需要单独迁移对象文件；
- 每次正式迁移先做 dry-run，记录新增 / 重复 / 冲突数量后再写入。

## 当前待同步项

**[待同步 PROD] 2026-08-22 — 小票 OCR / 采购成本数据基座**

- migration：`202608220002_receipt_ocr_schema.sql`、`202608220003_receipt_ocr_fk_indexes.sql`
- DEV 验证：5 表均启用 RLS；每表 4 条 owner policy；anon 无表读取；authenticated 有受 RLS 约束的 CRUD；4 个 owner 复合外键和覆盖索引存在；`receipt-images` 为私有 bucket，并有 owner read/insert/update/delete policy
- PROD 状态：未执行，本次明确不修改
- 前端依赖：当前无；后续小票上传/OCR/人工确认界面使用。小红书截图 OCR 是否复用该 bucket/表需另行设计，不混入小票采购事实
- 风险/回滚：migration 目前没有业务数据；如 DEV 试验需要回滚，应先删除 Storage 对象，再按子表到父表顺序删除 5 表和 bucket policy。PROD 同步前重新跑 advisor 与双账号 RLS 测试

词典四分类和用户词汇提案仍处于设计阶段，不属于当前数据库差异；本次繁中词汇先使用稳定前端 canonical id、显示名和别名，不新建正式词典表。

下次在 DEV 修改数据库结构时，先在本节加入：

```text
[待同步 PROD] YYYY-MM-DD — 变化名称
- migration：...
- DEV 验证：...
- PROD 状态：未同步
- 前端依赖：...
- 风险/回滚：...
```

同步完成后移动到上方日志，并改为 `已同步`。
