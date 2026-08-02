# CookingApp 管理者操作指南

这份指南面向 CookingApp 的所有者和管理者。它说明本地开发、线上使用、Supabase 数据管理、B 站 JSON 导入、备份、域名和日常维护。

## 1. 先理解四个系统各自负责什么

| 系统 | 作用 | 是否保存正式数据 |
|---|---|---|
| GitHub | 保存网页代码、数据库建表脚本、说明文档和版本历史 | 不保存正式菜谱和密钥 |
| VS Code | 在电脑上查看和编辑代码 | 只操作本地文件 |
| Node.js / npm | 安装网页依赖并在本机启动开发服务器 | 不负责数据库 |
| Supabase | 保存登录用户、菜谱、日志、食材、导入记录和图片 | 是正式数据存储位置 |
| ChatGPT Sites / Cloudflare 托管 | 让网页全天在线，不依赖个人电脑 | 保存部署版本和运行配置，不保存主要业务数据 |
| 域名注册商 | 提供自己的网址，例如 `cooking.example.com` | 不保存网页和菜谱 |

数据流如下：

```text
B站收藏夹 → 本地导出 JSON → CookingApp 导入中心
→ 转成待整理菜谱 → 登录后写入 Supabase
→ 浏览器或手机通过线上网址读取
```

## 2. 当前版本状态

V1 已完成以下能力：

- 页面、菜谱编辑、厨房模式、食材词典和做菜日志；
- 读取 B 站导出 JSON、按 BV 号去重并生成待整理菜谱；
- Supabase 邮箱魔法链接登录；
- 登录后读取和保存菜谱、食材与做菜日志；
- Supabase RLS 数据隔离和私有图片桶；
- 未登录或未配置 Supabase 时使用浏览器本地演示数据。

当前边界：

- JSON 只包含视频元数据，不能自动得到可靠的全部用量、温度和步骤；
- 导入后需要从 5–10 条样例开始人工整理和核验；
- 代码已经在 GitHub，并已建立 ChatGPT Sites 项目，但目前还没有发布版本或公网网址；完成 Sites checkpoint deployment 后才会成为无需运行 `npm` 的公网网站；
- 微信登录、多人投稿、周菜单、库存和自动营养分析属于后续版本。

## 3. 第一次在电脑上运行

### 3.1 需要安装

- Git
- Node.js 22 或更高版本（安装时自带 npm）
- VS Code

### 3.2 克隆仓库

只在第一次下载项目时运行：

```bash
cd /c/Users/你的用户名/Documents
git clone https://github.com/hlscshum2025/cookingapp.git
cd cookingapp
code .
```

也可以在 VS Code 中按 `Ctrl + Shift + P`，选择 `Git: Clone`，粘贴仓库地址后打开 `cookingapp` 文件夹。

### 3.3 配置 Supabase

在项目根目录复制环境变量模板：

```bash
cp .env.example .env.local
```

在 `.env.local` 中填写：

```env
NEXT_PUBLIC_SUPABASE_URL=https://你的项目编号.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_你的完整密钥
```

这两个值来自 Supabase Dashboard 的 `Project Settings → Data API / API Keys`。不要把数据库密码、secret key 或 `service_role` key 放进该文件，也不要把 `.env.local` 上传到 GitHub。

### 3.4 安装并启动

先确认终端位于项目目录，且能看到 `package.json`：

```bash
pwd
ls
node --version
npm --version
```

第一次运行或 `package-lock.json` 更新后执行：

```bash
npm install
```

启动本地开发网页：

```bash
npm run dev
```

打开终端显示的本地地址。停止本地网页使用 `Ctrl + C`。

## 4. 日常更新代码

仓库只需克隆一次。以后 GitHub 有新版本时，在 `cookingapp` 目录运行：

```bash
git pull origin main
npm install
npm run dev
```

`npm install` 可以重复运行；若依赖没有变化，它只会快速检查。运行命令前必须确认当前目录中存在 `package.json`。

## 5. 登录和导入 199 条视频

1. 确认 `.env.local` 已配置并重新启动网页。
2. 打开 `/login`，输入管理者邮箱。
3. 在同一浏览器中点击 Supabase 发来的魔法登录链接。
4. 打开“导入中心”。
5. 选择 `做饭-2026-08-02.json`。
6. 核对预览应显示 199 条，再点击确认导入。
7. 打开菜谱库，确认出现“待整理”项目。
8. 先整理 5–10 条不同类型的视频，不要一开始手工整理全部 199 条。

同一 JSON 重复导入时会按 BV 号跳过已经存在的内容。

## 6. 如何确认数据写入了 Supabase

### 6.1 查看登录用户

进入：

```text
Supabase Dashboard → Authentication → Users
```

点击过魔法登录链接后，应出现管理者邮箱。

### 6.2 查看业务数据

进入：

```text
Supabase Dashboard → Table Editor → schema: public
```

当前 migration 创建 10 张业务表：

| 表 | 用途 |
|---|---|
| `profiles` | 用户显示名、语言和时区 |
| `recipes` | 当前菜谱；详细内容位于 `document` JSONB |
| `recipe_versions` | 菜谱历史快照 |
| `cooking_logs` | 每次实际制作记录 |
| `ingredients` | 中英德食材词典与核验状态 |
| `source_videos` | B 站来源视频元数据 |
| `import_jobs` | 一次批量导入任务 |
| `import_items` | 导入任务中的单条项目 |
| `tags` | 标签定义 |
| `recipe_tags` | 菜谱与标签的关联 |

步骤、厨具、调味调整等被保存在 `recipes.document` 中，因此不会各自显示成独立表。图片在 `Storage → recipe-images`，登录账号在 `Authentication → Users`，也不属于 `public` 表。

### 6.3 用 SQL 快速核对

在 `SQL Editor → New query` 运行：

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;
```

查看每张表的记录数：

```sql
select 'recipes' as table_name, count(*) from public.recipes
union all select 'recipe_versions', count(*) from public.recipe_versions
union all select 'cooking_logs', count(*) from public.cooking_logs
union all select 'ingredients', count(*) from public.ingredients
union all select 'source_videos', count(*) from public.source_videos
union all select 'import_jobs', count(*) from public.import_jobs
union all select 'import_items', count(*) from public.import_items
union all select 'tags', count(*) from public.tags;
```

查看最近保存的菜谱：

```sql
select id, title, status, visibility, updated_at
from public.recipes
where deleted_at is null
order by updated_at desc
limit 20;
```

## 7. Supabase 日常管理

### 每次功能调整后

- 登录网页新增一条测试菜谱；
- 在 Table Editor 确认 `recipes` 出现记录；
- 编辑一次并确认 `recipe_versions` 生成历史版本；
- 确认其他未登录浏览器不能读取私密菜谱。

### 每月一次

- 在网页“设置与数据”导出完整 JSON 备份；
- 核对 Supabase 用量和项目状态；
- 核对域名和托管平台是否正常；
- 将备份保存在个人云盘或硬盘，不要提交到公开 GitHub 仓库。

### 免费方案注意事项

- 低活跃 Free 项目可能被暂停，需要在 Dashboard 中恢复；
- 免费方案不应被当作唯一备份；
- 数据库备份不包含 Storage 中的图片文件；
- 正式依赖该网站后，应制定数据库和图片的独立备份方案。

## 8. 上线后在德国如何使用

公网部署完成后，新版本通过 ChatGPT Sites 重新发布。你在德国、日本或其他地区只需要：

1. 用手机或电脑打开正式网址；
2. 用管理者邮箱登录；
3. 直接查看和编辑 Supabase 中的同一份数据。

不需要在自己的电脑上运行 Git Bash、VS Code 或 `npm run dev`。这些只用于开发和本地测试。网页能否在线取决于 Sites 托管与 Supabase，而不是你的电脑是否开机。

## 9. 部署与域名操作顺序

建议顺序：

1. 先把 GitHub 中的当前版本保存并发布为 ChatGPT Sites checkpoint deployment，获得生产网址；
2. 在 Sites 的 production environment variables 中配置两项 Supabase 环境变量，再发布新版本；
3. 在 Supabase 的 `Authentication → URL Configuration` 中加入 Sites 生产网址；
4. 完成登录、导入和云端保存验收；
5. 再购买或绑定自己的域名；Sites 会给出必须添加的 CNAME/A 记录和验证记录；
6. 把正式域名设为 Supabase Site URL，并保留本地地址作为 Redirect URL。

可以提前购买域名以避免喜欢的名称被注册，但不要在部署前反复修改 DNS。

如果希望一个域名承载多个个人项目，建议购买主域名，再用子域名：

```text
www.example.com       个人主页
cooking.example.com   CookingApp
model.example.com     手办项目展示
```

## 10. 常见故障

### `npm` 找不到 `package.json`

原因：终端不在项目目录。先运行：

```bash
cd /c/Users/你的用户名/Documents/cookingapp
ls
```

看到 `package.json` 后再运行 npm。

### 修改 `.env.local` 后仍显示演示模式

使用 `Ctrl + C` 停止服务器，再重新运行 `npm run dev`。检查变量名和等号两侧是否有多余字符。

### 登录邮件回到错误网址

在 Supabase `Authentication → URL Configuration` 中检查 Site URL 和 Redirect URLs。生产网址必须使用 `https://`。

### 网页能编辑但 Supabase 没数据

依次检查：是否已登录、设置页是否识别 Supabase 配置、浏览器是否显示云端错误、Table Editor 是否选择了 `public` schema。

### 不应做的操作

- 不要把 `service_role`、secret key、数据库密码提交到 GitHub；
- 不要直接删除整张表或关闭 RLS；
- 不要在没有备份时批量删除菜谱或 Storage 图片；
- 不要把包含私人日志的完整数据备份放进公开仓库。
