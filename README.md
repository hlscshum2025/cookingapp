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
- 公开只读分享页、二维码和复制链接；不展示私人日志和导入原始数据
- Supabase 邮箱魔法链接登录、RLS、自动版本快照
- 完整 JSON 备份导出和 PWA manifest
- 无数据库时可直接运行的演示数据模式

## 申请并初始化 Supabase

1. 打开 <https://supabase.com/dashboard>，使用 GitHub 账号登录。
2. 点击 `New project`；第一次使用时先创建一个 Organization，Free 方案即可。
3. 项目名填 `cookingapp`，设置一个强数据库密码并保存到密码管理器。
4. Region 选主要使用地附近：日本使用可选 Tokyo，德国使用可选 Frankfurt。
5. 等项目创建完成，进入 `SQL Editor`，新建查询。
6. 复制并运行 [`supabase/migrations/202608020001_cookingapp_v1.sql`](supabase/migrations/202608020001_cookingapp_v1.sql) 的全部内容。
7. 进入 `Project Settings → Data API / API Keys`，复制：
   - Project URL
   - Publishable key（旧项目可能显示 `anon public key`）
8. 在本地复制 `.env.example` 为 `.env.local`，填入这两项。
9. 进入 `Authentication → URL Configuration`，开发阶段把 Site URL 填为 `http://localhost:3000`；上线时改为正式域名，并把正式回调地址加入 Redirect URLs。

前端绝对不要使用 `service_role`、secret key 或数据库密码，也不要把 `.env.local` 提交到 GitHub。Publishable/anon key 可以出现在浏览器端，真正的数据隔离由 migration 中的 Row Level Security 完成。

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

1. 打开 `/login`，输入邮箱并点击邮件中的登录链接。
2. 在“导入中心”上传收藏夹工具导出的 JSON。
3. 导入项先成为“待整理”菜谱，不会凭空生成克数和火候。
4. 从 5–10 个差异较大的视频开始，人工整理食材与步骤。
5. 实际做成功后更新为“已成功/常做”，并新增一次做菜日志。

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

