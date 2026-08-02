# 一餐一记 CookingApp

把亲自做过并成功的视频菜谱，整理为可搜索、可修改、可持续记录的个人做菜知识库。

## V1 已实现

- 响应式首页、菜谱库、组合搜索和状态筛选
- 菜谱新增、编辑、删除，食材、厨具、步骤和标签
- 来源版/个人版的数据结构，制作日志与厨房逐步模式
- B站收藏夹 JSON 导入、BV号去重和待整理队列
- 中英德食材词典与无麸质人工核验提示
- 标签统计、完整 JSON 数据导出、邮箱魔法链接登录页
- Supabase PostgreSQL migration、RLS 权限和种子数据
- 未配置 Supabase 时可直接使用本地演示模式

## 本地启动

需要 Node.js LTS。克隆仓库后运行：

```bash
npm install
npm run dev
```

打开 http://localhost:3000。首次启动无需数据库，会使用浏览器本地数据。

## 连接 Supabase

1. 在 Supabase 新建项目。
2. 在 SQL Editor 运行 `supabase/migrations/0001_cookingapp_v1.sql`，再运行 `supabase/seed.sql`。
3. 复制 `.env.example` 为 `.env.local`。
4. 填写 Project URL 与 Publishable key，绝对不要提交 Secret/service_role key。
5. 重启 `npm run dev`。

详细产品、字段和开发说明见 [docs/feature_list.md](docs/feature_list.md)、[docs/database_schema.md](docs/database_schema.md) 和 [docs/development_plan.md](docs/development_plan.md)。

把个人验证成功的 B 站做饭收藏，整理成可持续修改、检索和分享的个人做菜知识库。

> 当前数据源：用户提供的 B 站“吃饭”收藏夹，约 197 个视频（数量待导入后核验）。
> 收藏夹：<https://space.bilibili.com/24529942/favlist?fid=3081759942&ftype=create>

## 项目定位

CookingApp 不只是收藏夹搬运工具，而是四个能力的组合：

1. **个人做菜知识库**：保存真正尝试过、做成功的菜。
2. **可修改菜谱系统**：原视频是来源，自己的步骤、调料调整、失败原因和心得才是核心数据。
3. **中英德食材工具**：提供食材中文、英文、德文名称，并记录德国超市常见替代品。
4. **饮食目标筛选器**：支持减脂、低盐、低油、无麸质、生理期个人饮食偏好等标签。

## 核心功能

- 从 B 站收藏夹导入视频元数据，不保存或转载视频文件
- 早餐、正餐、西餐、炸货、肉食主义等多标签分类
- 记录食材、用量、厨具、步骤、时间、难度与份数
- 原始做法与“我的版本”分开保存
- 做菜日志：日期、实际调整、结果、评分、心得与照片
- 中英德食材对照和德国超市替代品
- 按现有食材、厨具、用时、难度、饮食目标筛选
- 生成公开只读分享链接或二维码
- 后续支持购物清单、周菜单和营养信息

## 数据存放原则

| 内容 | 存放位置 |
|---|---|
| 代码、数据库结构、初始化标签、文档、脱敏备份 | GitHub |
| 正式菜谱、食材、步骤、个人修改、心得、用户数据 | Supabase / PostgreSQL |
| 菜谱图片 | Supabase Storage 或兼容对象存储 |
| B 站视频 | 不复制；只保存链接、BV 号、标题、作者、封面地址等元数据 |
| 密钥和登录信息 | 环境变量，不提交到 GitHub |

详细设计见：

- [产品与功能规划](docs/product-plan.md)
- [数据模型](docs/data-model.md)
- [技术与软件方案](docs/tech-stack.md)
- [B 站收藏夹导入方案](docs/bilibili-import.md)
- [B 站收藏夹本地导出工具](tools/bilibili-favorites-exporter/README.md)
- [实施路线图](docs/roadmap.md)

## 第一版（MVP）

第一版先完成“能用、可改、不会丢”：

- 导入约 197 条收藏视频的基本信息
- 手工/半自动把视频转换成菜谱
- 菜谱增删改查和多标签筛选
- 食材中英德字段
- “我的版本”和做菜心得
- 手机浏览与公开只读分享

暂不在第一版加入自动营养诊断、社交社区、复杂推荐算法或完整小程序双端开发。

## 当前状态

- [x] 明确产品定位
- [x] 确定 GitHub + Supabase 分层存储
- [x] 建立产品、数据、技术和路线图文档
- [x] 建立不上传 Cookie 的 B 站收藏夹本地导出工具
- [ ] 运行工具并核验“吃饭”收藏夹的 197 条视频
- [ ] 建立数据库
- [ ] 制作可点击原型
- [ ] 开发 MVP
