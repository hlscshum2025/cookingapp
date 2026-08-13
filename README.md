# CookingApp V1

把 B 站收藏中真正想做、做过并成功的菜，整理成可搜索、可修改、可记录经验的个人做菜知识库。

第一版已经包含可运行网页，而不只是设计文档。未连接数据库时自动进入演示模式；连接 Supabase 并登录后，菜谱、个人版本、做菜日志、食材词典和导入结果保存到云端。

## 已实现功能

- 响应式总览和手机底部导航
- 菜谱搜索、状态筛选、详情、新建、编辑和删除
- 来源视频、我的当前版本、历次制作日志三层信息
- 分组式食材与步骤编辑、份数、时间、难度、标签、厨具
- 厨房模式：大字号步骤、逐步勾选和份数换算
- B 站收藏夹 JSON 导入、BV 号去重、预览与待整理队列
- 中英德食材词典、德国购买关键词、无麸质与人工确认状态
- 做菜日志：日期、评分、本次调整、结果、下次改进和私有照片
- 公开只读分享页、二维码和复制链接骨架；私有首版暂不开放匿名数据库读取
- Supabase 邮箱魔法链接登录、RLS、自动版本快照
- 完整 JSON 备份导出和 PWA manifest
- 完整备份覆盖 10 张业务表；Storage 图片保持独立，避免 JSON 膨胀
- 无数据库时可直接运行的演示数据模式
- 手动录入工作台：来源视频、AI 字幕、画面证据、食材和步骤原子写入 Supabase

## 申请并初始化 Supabase

1. 打开 <https://supabase.com/dashboard>，使用 GitHub 账号登录。
2. 点击 `New project`；第一次使用时先创建一个 Organization，Free 方案即可。
3. 项目名填 `cookingapp`，设置一个强数据库密码并保存到密码管理器。
4. Region 选主要使用地附近：日本使用可选 Tokyo，德国使用可选 Frankfurt。
5. 等项目创建完成，进入 `SQL Editor`，新建查询。
6. 复制并运行 [`supabase/migrations/202608020001_cookingapp_v1.sql`](supabase/migrations/202608020001_cookingapp_v1.sql) 的全部内容。
7. 再复制并运行 [`supabase/migrations/202608030001_import_audit.sql`](supabase/migrations/202608030001_import_audit.sql)，补齐来源视频、逐条审计和原子批量导入函数。
8. 运行 [`supabase/migrations/202608090001_manual_recipe_entry.sql`](supabase/migrations/202608090001_manual_recipe_entry.sql)，安装手动录入的查重与原子保存函数。
9. 运行 [`supabase/migrations/202608090002_trigger_security_hardening.sql`](supabase/migrations/202608090002_trigger_security_hardening.sql)，禁止从 RPC 直接调用内部触发器函数。
10. 运行 [`supabase/migrations/20260810060929_harden_rls_cross_owner_relations.sql`](supabase/migrations/20260810060929_harden_rls_cross_owner_relations.sql)，关闭匿名菜谱读取并阻止跨用户关联注入。
11. 进入 `Project Settings → Data API / API Keys`，复制：
   - Project URL
   - Publishable key（旧项目可能显示 `anon public key`）
12. 在本地复制 `.env.example` 为 `.env.local`，填入这两项。
13. 进入 `Authentication → URL Configuration`，开发阶段把 Site URL 填为 `http://localhost:3000`；上线时改为正式域名，并把正式回调地址加入 Redirect URLs。

若要在有 `psql` 的管理环境重复验证真实越权矩阵，请把数据库连接串仅放在本机环境变量 `COOKINGAPP_DATABASE_URL` 中，然后运行 `bash scripts/run-rls-matrix.sh`。脚本不会把连接串写入仓库。

前端绝对不要使用 `service_role`、secret key 或数据库密码，也不要把 `.env.local` 提交到 GitHub。Publishable/anon key 可以出现在浏览器端，真正的数据隔离由 migration 中的 Row Level Security 完成。

### 四份 SQL 的统一名称

在 Supabase `SQL Editor` 中保存查询时，建议按下表命名。前两份负责安装，后两份只读检查：

| 顺序 | Supabase 中的保存名称 | 仓库文件 | 用途 | 可否重复运行 |
|---:|---|---|---|---|
| 01 | `01_CookingApp数据库初始化` | [`202608020001_cookingapp_v1.sql`](supabase/migrations/202608020001_cookingapp_v1.sql) | 创建业务表、RLS、Storage 策略和基础触发器 | 可以 |
| 02 | `02_B站导入审计升级` | [`202608030001_import_audit.sql`](supabase/migrations/202608030001_import_audit.sql) | 补充导入字段并安装批量导入函数 | 可以 |
| 03 | `03_检查数据库安装是否完整` | [`03_verify_installation.sql`](supabase/checks/03_verify_installation.sql) | 检查四张关键表和导入函数是否存在 | 只读，可随时运行 |
| 04 | `04_检查云端写入结果` | [`04_verify_cloud_data.sql`](supabase/checks/04_verify_cloud_data.sql) | 查看四张关键表记录数和最近导入任务 | 只读，可随时运行 |

如果 02 曾经报 `syntax error at or near "v_added"`，不要删表。拉取当前修正版后重新运行 02 全文即可；它已经补上缺失的分号，并按可重复执行方式编写。

## Windows 本地运行

先安装 Node.js 22 LTS、Git 和 VS Code，然后：

```powershell
git clone https://github.com/hlscshum2025/cookingapp.git
cd cookingapp
copy .env.example .env.local
npm install
npm run dev
```

浏览器打开终端显示的地址。若暂时不填 Supabase 配置，仍可以体验所有主要页面；演示修改只保存在当前浏览器。

## 第一次登录后的使用顺序

网页中的“登录”是 **CookingApp 应用用户登录**，由 Supabase Auth 负责；它不是 GitHub 登录、域名登录，也不是 Supabase Dashboard 账号登录。第一次不需要提前注册：输入一个能接收邮件的邮箱，点击 Supabase 发来的魔法链接，就会自动创建应用用户。

本地网页与 Supabase 要同时满足三项条件才能写入云端：

| 条件 | 怎样确认 |
|---|---|
| `.env.local` 已填 Project URL 和 Publishable key | 修改后重启 `npm run dev`；登录页不再提示缺少配置 |
| 数据库已运行 01 和 02 | 运行 03，五个结果都应为 `true` |
| 当前浏览器已完成邮箱登录 | 顶部显示“Supabase 已连接”，设置页显示登录邮箱 |

然后按下面顺序验证：

1. 打开 `/login`，输入管理者邮箱。
2. 在同一台电脑、同一浏览器中点击邮件里的魔法登录链接。
3. 到 Supabase `Authentication → Users`，确认出现该邮箱。
4. 打开“导入中心”，上传收藏夹工具导出的 JSON，选择“先试导入前 10 条”。
5. 页面必须显示“云端导入完成”；如果显示“本机演示导入完成”，四张表不会变化。
6. 运行 04：首次应有约 10 条 `source_videos`、10 条 `import_items`、10 条 `recipes` 和 1 条 `import_jobs`。
7. 再导入相同前 10 条，预期新增 0、重复 10。
8. 导入项只会成为私密“待整理”菜谱，不会凭空生成克数和火候。
9. 从 5–10 个差异较大的视频开始，人工整理食材与步骤。
10. 实际做成功后更新为“已成功/常做”，并新增一次做菜日志。

四张表为空通常表示还没有发生“已登录的云端写入”，不代表表本身断开。能在 Supabase Table Editor 中看到这些表，说明数据库结构已经存在；网页显示“未登录”时，程序会明确进入本机演示模式。

## 多灶台、多厨房调度：学习路线

这个功能属于运筹学中的约束调度。当前不需要训练 AI；先用 Google OR-Tools 的 CP-SAT 把步骤、设备、人员和上桌时间建模，日后再用真实做饭日志修正每一步的预计时长。

| 学习阶段 | 需要理解的内容 | 对应做饭场景 | 学习链接 |
|---:|---|---|---|
| 1 | Job Shop Scheduling | 多道菜各有步骤先后，同一灶位同一时间只能做一步 | [OR-Tools Job Shop](https://developers.google.com/optimization/scheduling/job_shop) |
| 2 | CP-SAT 与区间变量 | 为每一步建立开始、结束、持续时间，求一份可执行计划 | [CP-SAT Solver](https://developers.google.com/optimization/cp/cp_solver) |
| 3 | `NoOverlap` 与 `Cumulative` | 一口锅不可重叠使用；两个大火位表示容量为 2 | [CP-SAT Python API](https://or-tools.github.io/docs/pdoc/ortools/sat/python/cp_model.html) |
| 4 | RCPSP | 步骤有前置关系，同时受灶台、锅、烤箱、案板数量限制 | [OR-Tools RCPSP 示例](https://github.com/google/or-tools/blob/stable/examples/python/rcpsp_sat.py) |
| 5 | Employee Scheduling | 把切菜、翻炒、看火分给不同的人，并限制每个人不能同时做两件事 | [OR-Tools Employee Scheduling](https://developers.google.com/optimization/scheduling/employee_scheduling) |
| 6 | Multi-mode / Multi-skill RCPSP | 同一步可选大火、小火或不同厨房；不同人拥有不同技能 | [多技能、多模式 RCPSP 论文](https://www.nature.com/articles/s41598-023-45970-y) |

在 CookingApp 中的映射：一道菜是一个作业，切配/腌制/翻炒是任务，“先腌后煎”是前置约束，两个大火位是容量为 2 的资源，锅具和厨师也是资源，多厨房是可选执行地点。优化目标按优先级处理：先满足食品安全、步骤先后和资源容量等硬约束，再尽量让所有菜准时且接近同时上桌，减少成品放凉时间和人员空等。

实现顺序建议：先做单厨房固定计划，再加入多人分工和多个厨房，最后加入“某一步延误后，只重排尚未开始任务”的滚动重排。

## 数据存放

| 内容 | 存放位置 |
|---|---|
| 程序、migration、文档、导出工具、公开种子 | GitHub |
| 菜谱、版本、日志、食材词典、导入任务 | Supabase PostgreSQL |
| 本人上传的菜谱图片（后续接入） | Supabase Storage |
| B 站视频 | 不复制，仅保存公开链接和元数据 |
| 密钥 | `.env.local` / 部署平台环境变量，不进入 GitHub |

## 项目结构

```text
app/                    页面：总览、菜谱、导入、食材、日志、设置、分享
components/             可复用界面与本地/云端状态
lib/                    类型、演示数据和 Supabase 数据服务
supabase/migrations/    数据库表、索引、触发器和 RLS
tools/                  B 站收藏夹本地导出工具（原仓库保留）
docs/                   产品、数据库与开发规划（原仓库保留）
.env.example            可安全提交的配置模板
```

## 当前边界

- V1 不下载 B 站视频，也不上传 Cookie。
- AI 后续可辅助从字幕/简介生成候选，但未知用量、温度和时间必须为空并等待确认。
- 无麸质、过敏原和替代品信息是个人整理工具，不构成医疗建议。
- V1 暂不含完整周菜单、库存、购物清单、微信登录或多人协作；数据库已为后续扩展保留稳定主键。

详细规格仍见 `docs/feature_list.md`、`docs/database_schema.md` 和 `docs/development_plan.md`。

## 管理与学习文档

- [管理者操作指南](docs/ADMIN_GUIDE.md)：本地启动、Supabase 检查、JSON 导入、备份、部署、域名和排错。
- [代码与 npm 说明](docs/CODE_GUIDE.md)：解释 Git、VS Code、Node.js、npm、目录结构和主要代码职责。
- [最新后续路线图](docs/roadmap.md)：按云端验收、部署、首批内容和 V2 分阶段推进。
- [前 10 个视频试导入审计](docs/first-10-import-audit.md)：真实 JSON 抽样结果、字段缺口与需人工核验项。
- [成本、准备时间与多人厨房调度设计](docs/cost-time-scheduling-design.md)：V2 成本/时间模型与 V3 调度算法。
- [00｜V1 技术经验路线图](docs/00_v1_technical_experience.md)：记录从 0 到第一版的研发经验、范围调整与注意事项。
- [01｜全生命周期产品路线图](docs/01_product_roadmap.md)：记录已完成、未来、延期、替代和放弃的功能。
- [02｜V2 当前工作任务表](docs/02_v2_workboard.md)：只记录当前第二版的实际任务、状态和发布门禁。
- [99｜问题反馈与调整记录](docs/99_feedback_and_adjustments.md)：记录反馈、原因、调整、验证和后续。
