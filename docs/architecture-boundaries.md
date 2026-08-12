# CookingApp 架构边界与解耦检查

更新日期：2026-08-12

## 目标

CookingApp 后续会继续增加下厨房、小红书、多用户协作、成本、翻译采购、备份恢复和多菜谱厨房模式。为避免新增一个功能就同时修改页面、Supabase、导入和全局状态，本文件定义代码边界和重构优先级。

## 当前结论

当前代码已经有 `app / components / lib / supabase` 的基本分层，但业务层与基础设施层仍有明显耦合，暂时适合小规模迭代，不适合继续无边界扩张。

### 已经做得比较好的部分

- `lib/types.ts` 集中定义主要领域类型；
- `lib/manual-entry.ts` 把手动录入草稿和 payload 整理逻辑从 UI 中分离；
- `lib/video-review.ts` 独立处理字幕/证据结构；
- Supabase migration 保存在 `supabase/migrations`，数据库结构不是散落在页面里；
- `RecipeCard`、`RecipeTagEditor`、`SubpageBack` 等 UI 已开始组件化；
- 本地运行时已经与 Cloudflare/Miniflare 解耦，`npm run dev` 不要求 Cloudflare runtime。

## 当前高风险耦合点

### P0：CookingProvider 职责过多

`components/CookingProvider.tsx` 当前同时负责：

- Auth session 生命周期；
- Supabase 连接状态；
- recipes；
- logs；
- ingredients；
- import jobs；
- source videos；
- CRUD；
- B站导入 fallback；
- demo/localStorage。

后果：任何一个领域状态变化都可能让所有 `useCooking()` 消费者重新渲染；新增协作、购物清单、成本或多厨房后 Provider 会继续膨胀。

目标：逐步拆成小的领域服务和 Context，例如：

```text
SessionProvider
  └─ 只负责登录用户、session、connection status

RecipeProvider / useRecipes
  └─ 菜谱读取、保存、删除

ImportProvider / useImports
  └─ source videos、import jobs、平台导入

IngredientProvider / useIngredients
  └─ 食材词典

CookingLogProvider / useCookingLogs
  └─ 制作日志
```

不要求一次性重写，按功能触碰时逐步迁移。

### P0：UI 组件直接依赖 Supabase

当前多个页面/组件直接 import `lib/supabase`。这意味着 UI 同时知道“用户要做什么”和“Supabase 怎么做”。

目标依赖方向：

```text
UI / Page
  ↓
Domain service / hook
  ↓
Repository interface
  ↓
Supabase adapter
```

页面不应知道 `.from("recipes")`、RPC 名称、Storage bucket 或 SupabaseClient 类型。

建议逐步建立：

```text
lib/services/
  auth-service.ts
  recipe-service.ts
  import-service.ts
  backup-service.ts
  cooking-log-service.ts

lib/repositories/
  types.ts
  supabase-repository.ts
```

未来如果增加离线模式、测试内存库或迁移托管，只替换 adapter。

### P0：多来源导入仍以 B站为中心

`lib/bilibili.ts` 同时处理：

- B站 JSON 识别；
- 元数据规范化；
- 收藏夹批次；
- 直接生成 Recipe。

第二版加入下厨房和小红书前，应建立统一平台适配器：

```text
SourceAdapter
  platform
  canHandle(input)
  parse(input)
      ↓
SourceDraft
  platform
  externalId
  title
  author
  url
  coverUrl
  originalText
  ingredients?
  steps?
  evidence?
```

然后分别实现：

```text
BilibiliAdapter
XiachufangAdapter
XiaohongshuAdapter
ManualAdapter
```

导入中心只消费 `SourceDraft`，不再写平台专属判断。

## 中风险问题

### P1：乐观更新缺少统一回滚

当前部分保存操作会先更新 React state，再异步写 Supabase；写入失败时主要展示错误，但本地 UI 可能暂时与云端不一致。

目标：领域 service 返回明确结果，失败自动回滚或重新 fetch。

### P1：运行时配置曾与 Cloudflare Worker 绑定

已经在 2026-08-12 修复：

- 本地 `vite dev` 不加载 Cloudflare plugin；
- 新增框架级 `/api/runtime-config`；
- Cloudflare plugin 仅作为当前 Sites production build adapter 保留。

未来迁移 Vercel/其他托管时，不需要重写客户端 Supabase 配置读取逻辑。

### P1：状态标签、内容标签、食材、作者需要保持领域分离

不要把以下概念重新塞回同一个 `tags: string[]`：

- 食材：来自 recipe.ingredients；
- 作者/UP主：来自 recipe.source.uploader；
- 内容标签：recipe.tags；
- 工作流状态：recipe.status / verification status。

标签筛选中心可以把它们组合展示，但数据库含义必须分开。

## 推荐依赖方向

```text
app/pages
   ↓
components + domain hooks
   ↓
services
   ↓
repositories / source adapters
   ↓
Supabase / Bilibili / Xiachufang / Xiaohongshu
```

禁止反向依赖：

- `lib` 不 import `app/page`；
- 平台 adapter 不 import UI；
- 页面不直接拼 SQL/RPC payload；
- Supabase adapter 不决定按钮/页面状态；
- 标签筛选逻辑不修改原始 Recipe 数据。

## 重构顺序

### 当前第二版发布前

1. [x] 本地开发与 Cloudflare runtime 解耦；
2. [x] runtime config 提供平台中立 API route；
3. [ ] 给来源导入建立 `SourceAdapter` / `SourceDraft` 接口；
4. [ ] 将手动录入的 Supabase 调用移入 manual-entry service；
5. [ ] 将设置页备份逻辑移入 backup service；
6. [ ] 为保存失败增加一致的 rollback/refetch 策略。

### 接入下厨房 / 小红书前

1. [ ] B站逻辑迁入 `source-adapters/bilibili`；
2. [ ] Import Center 只依赖统一 SourceDraft；
3. [ ] 下厨房和小红书分别添加 adapter，不修改 B站 adapter；
4. [ ] 为每个 adapter 增加独立 fixture/test。

### 协作、成本、多厨房前

1. [ ] 拆分 CookingProvider；
2. [ ] 建立 repository interface；
3. [ ] 页面层停止直接 import `lib/supabase`；
4. [ ] 每个领域拥有独立测试；
5. [ ] DEV Supabase 与 PROD Supabase 始终隔离。

## 判断一个新功能是否耦合过高

新增功能时如果出现以下任一情况，应先重构再继续：

- 为加一个按钮需要修改 5 个以上无关模块；
- 页面直接新增 `.from(...)` / `.rpc(...)`；
- 为支持新平台需要修改另一个平台的 parser；
- 一个 Context 新增超过一个独立业务领域；
- 一个组件既做解析、网络请求、数据库写入又负责复杂 UI；
- 测试一个功能必须连接真实生产 Supabase。

这份规则作为后续功能开发的架构门槛。
