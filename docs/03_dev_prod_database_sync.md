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

## 当前结构状态

**2026-08-14：DEV 与 PROD 的实际数据库对象结构已对齐。**

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

**无。**

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
