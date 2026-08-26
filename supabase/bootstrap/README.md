# 历史初始化脚本

这些脚本对应已经存在于当前 Supabase 项目、但早于正式 migration history 或曾通过人工 SQL 安装的结构。它们保留用于审计和从空数据库重建，不由 GitHub Supabase Integration 自动执行。

新建独立开发数据库时，先依据文件时间戳与 `../migrations/` 合并排序并在本地空库验证，或用 Supabase CLI 从当前远端结构生成新的基线；不要把两个目录分别整批执行，也不要对已有 PROD 重复执行。
