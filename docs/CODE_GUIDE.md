# CookingApp 代码与 npm 说明

## 1. Git、GitHub、VS Code、Node.js 和 npm 的区别

| 工具 | 可以把它理解成 | 主要用途 |
|---|---|---|
| Git | 本地版本记录器 | 比较改动、提交、回到历史版本 |
| GitHub | 云端代码仓库 | 保存和同步代码，连接自动部署 |
| VS Code | 代码编辑器 | 查看文件、编辑代码、打开终端 |
| Node.js | JavaScript 运行环境 | 让电脑能够运行网页开发工具 |
| npm | Node.js 的包管理器和命令入口 | 安装依赖、启动、构建和测试项目 |

Git Bash 只是一个可以输入命令的终端。npm 并不要求必须在 Git Bash 中运行；VS Code 终端、PowerShell、Windows Terminal 也可以。真正的要求是：终端当前目录必须是包含 `package.json` 的 `cookingapp` 项目根目录。

## 2. npm 到底做什么

项目根目录的 `package.json` 像一张“软件清单和快捷命令表”。其中：

- `dependencies` 列出网页运行需要的库；
- `devDependencies` 列出开发、检查和构建工具；
- `scripts` 定义 `npm run dev`、`npm run build` 等命令。

常用命令：

| 命令 | 作用 | 何时运行 |
|---|---|---|
| `npm install` | 按 `package-lock.json` 下载/检查依赖，放到 `node_modules` | 首次下载或依赖有变化时 |
| `npm run dev` | 启动本地开发服务器，修改代码后快速刷新 | 本地开发和试用时 |
| `npm run build` | 生成用于上线的正式构建并检查构建错误 | 发布前或排查上线问题时 |
| `npm test` | 运行项目测试 | 修改核心功能后 |
| `npm run lint` | 检查常见代码质量问题 | 提交代码前 |

`npm install` 不需要每次打开网页都运行；依赖没有变化时可以跳过。`npm run dev` 只负责本地网页，所以关闭终端或按 `Ctrl + C` 后，本地地址就打不开。部署到 Vercel 后，服务器替你运行正式版本，普通使用不再需要 npm。

## 3. 项目目录的作用

```text
app/                         各个网址页面
components/                  多页面共用的界面和全局数据状态
lib/                         数据类型、演示数据、Supabase 读写
supabase/migrations/         建表、索引、触发器、RLS 和 Storage 策略
tools/                       B 站收藏夹本地导出工具
docs/                        产品、数据库、路线图和管理说明
public/                      图标、manifest 等静态文件（如存在）
.env.example                 环境变量模板，可以提交
.env.local                   本机真实配置，不能提交
package.json                 npm 项目清单与命令
package-lock.json            锁定依赖版本，保证不同电脑安装一致
tsconfig.json                TypeScript 编译规则
next.config.* / vite.config.* 网页框架和构建配置
```

## 4. 页面代码 `app/`

Next.js App Router 使用文件夹代表网址。典型映射是：

| 文件 | 网页功能 |
|---|---|
| `app/page.tsx` | 首页和总览 |
| `app/recipes/page.tsx` | 菜谱库、搜索和筛选 |
| `app/recipes/new/page.tsx` | 新建菜谱 |
| `app/recipes/[id]/page.tsx` | 某一条菜谱详情 |
| `app/recipes/[id]/edit/page.tsx` | 编辑菜谱 |
| `app/recipes/[id]/cook/page.tsx` | 厨房逐步模式 |
| `app/imports/page.tsx` | 读取 B 站 JSON、预览、去重并确认导入 |
| `app/ingredients/page.tsx` | 中英德食材词典 |
| `app/tags/page.tsx` | 标签管理和统计 |
| `app/login/page.tsx` | Supabase 邮箱魔法链接登录 |
| `app/settings/page.tsx` | 数据库状态、备份与偏好 |
| `app/layout.tsx` | 所有页面共同的外壳 |
| `app/globals.css` | 全站颜色、排版和响应式样式 |

文件顶部的 `"use client"` 表示该页面或组件需要在浏览器中处理点击、输入、文件读取或本地状态。

## 5. 公共组件 `components/`

### `CookingProvider.tsx`

这是网页的数据中枢：

1. 页面启动时先读取浏览器 `localStorage`；
2. 如果已配置 Supabase 并且用户已登录，再读取云端数据；
3. 新增或编辑菜谱时先更新页面状态，同时调用云端保存函数；
4. 导入 JSON 时按 BV 号去重，把视频转换为 `inbox` 待整理菜谱；
5. 云端失败时保留本地状态并显示错误信息。

### 表单、卡片和导航组件

这类文件把重复界面封装起来。例如菜谱卡片会被首页和菜谱库共同使用；编辑表单同时服务新建和修改页面。这样修改一次即可影响所有使用位置。

## 6. 数据与 Supabase 代码 `lib/`

### `lib/types.ts`

定义菜谱、食材、步骤、日志和 B 站视频在 TypeScript 中应该有哪些字段。它像数据的“表格列说明”，能提前发现拼错字段或类型不一致。

### `lib/demo-data.ts`

提供没有数据库时也能展示页面的演示菜谱。演示数据不等于正式 Supabase 数据。

### `lib/supabase.ts`

负责真正的云端读写：

- `getSupabase()`：根据环境变量创建 Supabase 客户端；
- `loadCloudData()`：登录后读取菜谱、日志和食材；
- `persistRecipe()`：新增或更新菜谱；
- `removeCloudRecipe()`：软删除菜谱，不立即物理擦除；
- `persistLog()`：保存做菜日志；
- `persistIngredient()`：保存食材词典；
- `getPublicRecipe()`：只读取标为公开的菜谱；
- `uploadLogPhoto()`：上传私有日志照片并生成临时访问链接。

浏览器端只使用 Publishable key。每条数据库请求还会携带当前登录用户身份，Supabase 的 RLS 决定该用户能读写哪些行。

## 7. 数据库代码 `supabase/migrations/`

Migration 是数据库的“可重复施工图”，负责：

- 创建 10 张 `public` 业务表；
- 创建索引，提升搜索和列表速度；
- 创建菜谱修改前的历史快照触发器；
- 启用 RLS，让每个用户只能管理自己的数据；
- 创建 `recipe-images` 私有图片桶和访问策略；
- 新用户登录后自动创建 `profiles` 行。

以后数据库结构发生变化，应新增 migration 文件，而不是只在 Supabase 网页里临时改表，否则 GitHub 中的数据库施工图会和实际数据库不一致。

## 8. B 站 JSON 导入代码

`tools/bilibili-favorites-exporter/export-favorites.js` 在已登录的 B 站页面本地运行，只提取公开元数据，不上传 Cookie，也不下载视频。

网页导入大致经过：

```text
选择 JSON 文件
→ 浏览器 File API 读取文本
→ JSON.parse 转为对象
→ 找出 videos/items/medias 数组
→ 按 bvid 去重
→ 构造 Recipe
→ CookingProvider 更新页面
→ persistRecipe 写入 Supabase（已登录时）
```

导入器不会编造视频中没有的克数、火候和步骤。它先建立“来源和待整理队列”，之后再由人工或后续 AI 辅助流程补全。

## 9. `.env.local` 为什么不能放进 GitHub

环境变量让同一份代码连接不同的数据库：

- 本机开发读取 `.env.local`；
- Vercel 在线部署读取项目后台的 Environment Variables；
- GitHub 只保存 `.env.example`，不保存真实值。

Publishable key 本身是给浏览器使用的，但仍不应和其他秘密混在文档中。`service_role` 和 secret key 能绕过 RLS，绝对不能出现在前端代码、聊天截图或公开仓库。

## 10. 本地运行与线上运行的区别

| 项目 | 本地开发 | 线上网站 |
|---|---|---|
| 地址 | `localhost` | `*.vercel.app` 或自己的域名 |
| 谁提供服务器 | 你的电脑和 `npm run dev` | Vercel |
| 电脑关机后 | 本地网页停止 | 不受影响 |
| 配置位置 | `.env.local` | Vercel Environment Variables |
| 用途 | 修改、调试、试验 | 日常手机和电脑使用 |

## 11. 修改代码后的安全检查

```bash
npm run lint
npm test
npm run build
git status
```

确认检查通过且没有把 `.env.local`、私人 JSON 或数据备份加入 Git，再提交和推送。GitHub 连接到 Vercel 后，推送到主分支会自动触发新部署。

