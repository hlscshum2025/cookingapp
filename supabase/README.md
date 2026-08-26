# Supabase 目录约定

`migrations/` 只保存已经进入生产项目 migration history 的版本，文件名前缀必须与 Supabase 远端记录完全一致。GitHub 的 **Supabase Preview** 检查会据此判断仓库与数据库是否发生 migration drift。

- `migrations/`：当前 PROD 已记录的迁移；不要修改时间戳。
- `bootstrap/`：正式 migration history 建立以前或通过人工 SQL 安装的历史脚本，仅用于审计和新环境重建，不由 GitHub 集成自动执行。
- `pending_migrations/`：已经设计但尚未批准同步 PROD 的迁移。确定发布批次并完成 DEV/RLS 验收后，使用 Supabase CLI 创建正式迁移版本，再移入 `migrations/`。
- `checks/`：只读安装与数据核验 SQL。
- `tests/`：RLS 和权限测试。

不要为了让 GitHub 变绿而把待发布 SQL 提前放回 `migrations/`；这会在 `main` 更新时触发生产数据库部署。
