# CookingApp V1 完整设计与功能/文件清单

## 1. 产品结论

第一版是手机优先的响应式 Web App / PWA，服务于“把亲自做过且成功的视频菜谱，整理成自己的长期做菜知识库”。公开用户可以查看你主动分享的菜谱，但不能看到私人做菜日志，也不能修改内容。

首版借鉴而不复制以下开源项目：

| 参考项目 | 借鉴内容 | V1 取舍 |
|---|---|---|
| Tandoor Recipes | 菜谱、食材、计划、购物清单之间的关系 | 实现菜谱和食材；计划/购物清单只预留 |
| Mealie | URL 导入、可编辑菜谱、API 分层与自托管思路 | 实现来源导入队列、编辑器和清晰服务层 |
| Open Food Facts | 商品条码、包装食品和营养外部数据 | 只保留外部引用接口，不把其数据复制为主库 |
| Obsidian Recipe View | 内容可移植、清晰的厨房阅读模式 | 提供专注阅读页和 JSON/CSV 导出思路 |

## 2. V1 使用流程

1. 在自己已登录 B 站的电脑上导出收藏夹公开元数据；Cookie 不离开本机。
2. Web 管理端导入 JSON，按 BV 号去重，并显示成功、重复、失效和失败项。
3. 选择一个视频，依据标题、简介或字幕生成候选菜谱；未知克数、时间不得臆造。
4. 人工校对食材、厨具、步骤、标签和中英德名称，保存为来源版。
5. 创建“我的当前版本”，记录自己实际采用的用量、步骤和替代品。
6. 每次做菜新增日志，保存变化、结果、评分、照片和下次改进。
7. 日常通过搜索、标签、时间、厨具、食材和状态找菜；在厨房模式查看大字号步骤。
8. 需要分享时生成只读链接或二维码，私人日志默认不包含。

## 3. 页面与功能

| 页面/模块 | V1 功能 | 验收重点 |
|---|---|---|
| 登录页 | 邮箱魔法链接；首个账号为管理员 | 未登录不能进入管理页 |
| 首页 | 搜索、最近做过、常做、待整理、快速筛选 | 手机一屏可进入常用动作 |
| 菜谱库 | 卡片/列表、分页、组合筛选、排序 | 多标签不是互斥文件夹 |
| 菜谱详情 | 来源、个人当前版、食材、厨具、步骤、标签、日志摘要 | 三层信息不混在一起 |
| 菜谱编辑器 | 基本信息、分组食材、步骤排序、用量、温度、提示、保存草稿 | 人工修正永远可用 |
| 厨房模式 | 大字号、逐步勾选、屏幕常亮提示、份数换算展示 | 不修改数据库原用量 |
| 做菜日志 | 日期、评分、结果、调整、心得、下次改进、照片 | 可保存多次记录 |
| 食材词典 | 中英德名、别名、类别、无麸质状态、德国货架词、替代品 | 校验状态清晰可见 |
| 导入中心 | 上传导出 JSON、预览、去重、进度、失败重试、转换菜谱 | 可中断恢复，不重复建菜谱 |
| 标签管理 | 餐次、风格、主食材、方法、时间、难度、目标、状态 | 支持自定义标签 |
| 分享页 | 公开只读页面、撤销、可选过期时间、二维码 | 不泄露日志和原始导入数据 |
| 设置/导出 | 语言、时区、默认份数、JSON/CSV 数据导出 | 能离开平台并保留数据 |

## 4. 筛选维度

- 关键词：菜名、摘要、食材中英德名称和别名。
- 时间：15 分钟内、30 分钟内、自定义上限。
- 状态：只收藏、准备尝试、已成功、需改进、常做。
- 食材：包含/排除，可选择“手头已有”。
- 厨具：空气炸锅、烤箱、炒锅等。
- 饮食标签：减脂、高蛋白、低油、低盐、无麸质和个人偏好。
- 难度、餐次、菜系/风格、烹饪方法。

“无麸质”等健康相关结果必须显示人工确认状态；它们用于个人筛选，不构成医疗建议。

## 5. 数据和媒体边界

- GitHub：源代码、数据库 migration、文档、测试、公开种子和脱敏样例。
- Supabase PostgreSQL：菜谱、版本、食材、标签、日志、导入状态和权限数据。
- Supabase Storage：自己上传的成品与过程图。
- B 站：只保存 URL、BV 号、标题、作者、封面等元数据；不下载或重新发布视频。
- 密钥：只放 `.env.local` 和部署环境变量；仓库只提交 `.env.example`。

## 6. V1 不做但预留

- 完整周菜单、库存和购物清单工作流。
- 自动营养诊断、疾病建议和无法溯源的健康结论。
- 社交社区、评论、关注、多人共同编辑。
- 微信登录与微信小程序双端。
- 向量数据库、复杂推荐模型、独立微服务。
- 自动爬取受限内容或上传 B 站 Cookie。

## 7. 推荐代码文件清单

```text
app/
  (public)/share/[token]/page.tsx
  (auth)/login/page.tsx
  (dashboard)/page.tsx
  (dashboard)/recipes/page.tsx
  (dashboard)/recipes/[id]/page.tsx
  (dashboard)/recipes/[id]/edit/page.tsx
  (dashboard)/recipes/[id]/cook/page.tsx
  (dashboard)/ingredients/page.tsx
  (dashboard)/imports/page.tsx
  (dashboard)/tags/page.tsx
  (dashboard)/settings/page.tsx
  api/imports/route.ts
  api/recipes/route.ts
  api/share/route.ts
components/
  recipes/RecipeCard.tsx
  recipes/RecipeEditor.tsx
  recipes/IngredientEditor.tsx
  recipes/StepEditor.tsx
  recipes/RecipeFilters.tsx
  cooking/CookingMode.tsx
  logs/CookingLogForm.tsx
  imports/ImportPreview.tsx
  ingredients/IngredientDictionary.tsx
  share/ShareDialog.tsx
lib/
  supabase/client.ts
  supabase/server.ts
  repositories/recipes.ts
  repositories/ingredients.ts
  services/import-service.ts
  services/recipe-service.ts
  services/share-service.ts
  validation/recipe.ts
  validation/import.ts
  search/recipe-filters.ts
  types/database.ts
supabase/
  migrations/0001_extensions.sql ... 0008_seed_reference_data.sql
  seed.sql
scripts/
  export-bilibili-favorites/
  import-favorites.ts
  export-user-data.ts
data/seeds/
  tags.json
  ingredients.sample.json
docs/
  database_schema.md
  feature_list.md
  development_plan.md
  ingredient_mapping.xlsx
tests/
  unit/recipe-validation.test.ts
  unit/import-dedup.test.ts
  integration/recipe-crud.test.ts
  integration/rls-privacy.test.ts
  e2e/import-to-recipe.spec.ts
  e2e/share-privacy.spec.ts
.env.example
.gitignore
README.md
package.json
```

## 8. V1 完成定义

- 成功导入并核验收藏夹清单，重复运行不会生成重复视频或菜谱。
- 至少 10 条真实视频完成“来源版 → 我的版 → 做菜日志”全过程。
- 手机端可创建、修改、筛选、查看和分享菜谱。
- 中英德食材映射可搜索、可校对并带验证状态。
- RLS 自动化测试证明用户私有数据及日志不会出现在公开分享中。
- 数据可导出，数据库可由 migration 在空环境重建。
- 错误页面、空状态、加载状态和失败重试均具备基本可用性。

