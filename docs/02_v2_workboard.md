# 02｜CookingApp V2 当前工作任务表

更新日期：2026-09-04

当前阶段：V2 开发与本地验收。
原则：本文件只保留**尚未完成**的代码、数据库、部署或实机验证；完成项及过程证据统一归档到 [`00_v2_development_history.md`](./00_v2_development_history.md)，长期设想进入 [`01_product_roadmap.md`](./01_product_roadmap.md)。

状态仍按以下顺序判断，不能把代码存在当成最终完成：

```text
待设计 → 开发中 → 已合入 main → 已迁移 → 已部署 → 已实机验收
```

## 1. 当前基线与新一轮待验收

2026-09-04 的当前发布批次只上线 OCR 私有上传队列、管理员本地 worker 与两个核验入口。队列依赖的两份 migration 已按 `03` 完成 DEV 验证并同步 PROD；旧的小票采购事实表和物品识别表仍不属于本次发布依赖，继续留在待发布目录。

## 2. 多来源导入：只剩小红书截图 OCR

| ID | 当前任务 | 状态 | 完成定义 |
|---|---|---|---|
| V2-OCR-10 | 小红书截图 OCR 导入 | **代码、队列和导入中心界面完成，待正式站实机验收** | 支持1–12张有序截图；跨行“食材名／用量”自动合并；识别标题、食材、用量和步骤候选，带入现有菜谱表后仍需人工确认。 |
| V2-OCR-11 | 管理员按需 OCR 队列 | **DEV/PROD 结构已同步，worker 完成，待真实账号闭环** | 用户可提交后离开页面；管理员电脑之后运行 `queue-worker`；结果按账号回写，worker 密钥永不进入浏览器或 Sites。 |

B站、下厨房、普通文本、统一来源结构、导入中心 GUI、能力提示、页面提取器和新平台反馈均已移入 `00-V2`，不再占用当前工作表。这里的正确术语是 **OCR（Optical Character Recognition）**，不是 ORC。

## 3. 小票 OCR、成本入库与食材视觉识别（V2 主线）

### 3.1 德国小票

`V2-OCR-01～03` 已于 2026-08-31 由用户确认完成并移入 `00-V2`：统一契约、OpenCV + PaddleOCR baseline、批处理/日志/首轮德国小票测试基线不再作为开放任务重复出现。

| ID | 当前任务 | 状态 | 完成定义 |
|---|---|---|---|
| V2-OCR-04 | 商品行映射厨房词典 | 待设计 | 商店缩写先匹配市场别名，再映射稳定 ingredient id；低置信度必须人工确认。 |
| V2-OCR-05 | 小票核验、删除与写入界面 | **识别与逐行删除完成，正式写入待开发** | 饮食记账可从多图小票生成待核对清单，食品、日用品和未知商品均保留并可删除；“确认并记账”仍禁用，不能提前写正式采购事实。 |
| V2-OCR-06 | OCR 数据结构同步 PROD | **异步队列已同步；采购/视觉候选表仍待发布** | 本次只同步网页实际依赖的 `ocr_jobs/ocr_job_files` 与私有 bucket；旧的5张小票采购表、2张视觉表仍按 `03` 等待对应确认事务。 |
| V2-OCR-07 | OCR / 词典 / 采购 / 粮仓数据库契约 | DEV migration 已验证，待核验界面 | `receipt-ocr-draft-v1` 可落到小票 run/items；词典匹配与采购事实分层，只有人工确认才可写入成本或粮仓。 |

### 3.2 冰箱、台面和袋装食材

| ID | 当前任务 | 状态 | 完成定义 |
|---|---|---|---|
| V2-VISION-01 | 统一 `VisionCandidate` 契约 | Python 契约与 JSON 输出已建立，待样本校准 | 类别候选、bbox/mask、数量范围、置信度、模型版本和原图引用可追溯。 |
| V2-VISION-02 | YOLO / YOLO-World 物品识别 baseline | **开发中（独立分支，尚未合入 `main`）** | 对苹果、香蕉、番茄、鸡蛋、牛奶等真实照片记录 precision/recall、误检与漏检。 |
| V2-VISION-03 | 实例分割、数量估计与数据集 | 待实验/准备 | 比较 YOLO segmentation 与 SAM；透明袋、反光、遮挡和连拍数据正确划分 train/val/test。 |
| V2-VISION-04 | OCR/条码/重量证据融合 | 待设计 | 多证据可提高候选，但冲突时保留 unknown；不能仅凭一个传感器静默写库存。 |
| V2-VISION-05 | 线上冰箱确认界面 | 待开发 | 用户可改类别、数量和单位，确认后才更新库存，取消不留下正式记录。 |
| V2-VISION-06 | 视觉候选与词典/粮仓数据库契约 | DEV migration 已验证，待核验界面 | `vision-candidate-v1` 可追溯保存；稳定 ingredient 外键与 canonical key 回退并存；未确认候选不能关联 `pantry_items`。 |

V2 先用预训练模型建立真实 baseline；只有错误模式稳定后才决定微调和硬件。超市压力传感器属于很有价值的额外证据，但当前不要求制作 CookingApp 专用秤或摄像硬件。

## 4. PWA 与批量本地工作流

| ID | 当前任务 | 状态 | 完成定义 |
|---|---|---|---|
| V2-PWA-01 | 安装资源 | 代码完成，待 HTTPS 实机验收 | Android/桌面可安装，iOS 有 Safari 指引；192/512/maskable 与 Apple 图标齐全。 |
| V2-PWA-02 | Service Worker 与更新策略 | 代码完成，待部署验收 | 只缓存静态外壳和公共资源；不缓存 API、Supabase 私人响应或会话；断网导航显示离线页。 |
| V2-PWA-03 | 安装后主流程验收 | 待测试 | 桌面图标启动、登录恢复、深链接、退出、在线/弱网/离线和升级流程正确。 |
| V2-BATCH-01 | 多菜谱 IndexedDB 待上传队列 | 代码完成，待真实批量验收 | 多份文字菜谱可逐条校验、一键同步；成功项移除、失败项保留、同来源同 candidate 幂等更新；正式数据仍以 Supabase 为准。 |

## 5. 词典、公开内容与采购功能

### 5.1 识别完成后开始词典扩展

| ID | 当前任务 | 状态 | 完成定义 |
|---|---|---|---|
| V2-DICT-01 | 食材、调料、厨具、特殊厨具分类 | 待设计 | canonical 实体稳定；别名、替代品、地区和限制不靠复制实体表达。 |
| V2-DICT-02 | 用户新增/修改词汇提案 | 待开发 | 用户可提交名称、语言、地区、类别、证据和修改理由，不能直接覆盖正式词典。 |
| V2-DICT-03 | 管理员审核与 RLS | 待设计，禁止直接迁移 PROD | 审核通过/拒绝/合并可追溯；用户只读自己的提案，管理员按专用权限审核。 |

### 5.2 仍未完成的现有 V2 业务

| ID | 当前任务 | 状态 | 完成定义 |
|---|---|---|---|
| V2-PUB-01 | 成品图封面部署验收 | 已合入，待部署/隐私验收 | 无图占位稳定；私人日志图不被公开。 |
| V2-PUB-02 | 公开菜谱点赞与排序 | 待 migration/双账号验收 | 一账号一红心，取消正确；点赞数不可由客户端任意改；排序可解释。 |
| V2-PUB-03 | 批量审核和运营标签 | 待开发 | 管理员操作有审计，普通用户不能赋权。 |
| V2-SHOP-01 | 份数缩放与同单位合并 | 待开发 | 可换算项正确合并，不可换算单位并列且保留原值。 |
| V2-SHOP-02 | 采购勾选与线上冰箱实机验收 | 已有代码/结构，待 Sites + 双账号验收 | 增加、用完、采购排除、导出和 RLS 均通过电脑与手机。 |
| V2-COST-01 | 采购记录、成本快照与调料估价 | 待设计 | 价格、币种、净量、商店、日期和每人份可追溯；估价明确标记。 |
| V2-DE-01 | 德国包装与货架词扩充 | 待真实使用 | 记录来源、地区、同步时间和人工核验状态。 |

## 6. 可靠性与技术债（仍开放）

| ID | 当前任务 | 状态 | 通俗解释 / 完成定义 |
|---|---|---|---|
| V2-REL-02 | 自定义 SMTP | 条件待办 | 公开扩大注册前配置域名发件服务并验证 SPF/DKIM/DMARC；密码只存 Supabase。 |
| V2-REL-03 | Storage 图片备份恢复 | 等真实测试图 | DEV 做上传→备份→删除→恢复→业务页可读，不直接拿 PROD 试。 |
| V2-REL-04 | 监控与告警 | 待设计 | 能区分登录、抓取、OCR、数据库和部署失败；不记录私人正文、小票内容或密钥。 |
| V2-ARCH-01 | service/repository 分层 | 按触碰范围渐进处理 | 数据库查询集中到固定模块，用户只需按原流程回归。 |
| V2-ARCH-02 | 拆分 `CookingProvider` | 前端性能技术债，不是数据库任务 | 根层只留会话/连接；菜谱、来源、粮仓、OCR/视觉按路由加载，减少首屏查询与无关重渲染。 |
| V2-REL-05 | DEV → PROD 只追加工具 | 发布前待办 | dry-run、冲突列表、默认只追加、失败回滚和审计；绝不整库覆盖。 |

## 7. 临时额外工作：开源、Local-first 与模块化重构准备

这组任务来自对水杉输入法等模块化开源项目的结构借鉴。它们**不替代 V2 当前 OCR / 视觉 / 采购主线，也不要求一次性重构全部代码**；原则是以后每次触碰相关模块时顺手把边界变清晰，为公开协作、本地 EXE、SQLite、可选 OCR/YOLO/ASR 和后续 Tauri 做准备。

### 7.1 Domain Core 与目录边界

| ID | 临时任务 | 状态 | 完成定义 |
|---|---|---|---|
| V2-ARCH-03 | 定义 `Domain Core` | 待设计 | 菜谱、词典、采购、库存、成本的类型与业务规则不直接依赖 React、Next.js、Supabase 或 Python；可被 Web、PWA、Desktop 共用。 |
| V2-ARCH-04 | 渐进整理 monorepo 目录 | 待设计，禁止大爆炸式搬家 | 目标边界参考 `apps / packages / services / features`；只在触碰文件时迁移并保留兼容导出，不一次性改完导致大量冲突。 |
| V2-ARCH-05 | 模块依赖方向与契约测试 | 待设计 | `UI → service → repository/provider` 单向依赖；禁止页面绕过 service 直接跨模块查询别人的表；关键 interface 有 contract test。 |

建议目标结构（只是边界目标，不要求本批次一次建齐）：

```text
apps/
  web/                 # Next.js / vinext Web 与 PWA 外壳
  desktop/             # 未来 Tauri 外壳
packages/
  core/                # 通用类型、错误、事件、业务约束
  recipes/             # 菜谱领域
  dictionary/          # canonical 厨房词典、alias、翻译候选
  shopping/            # 采购车与清单
  inventory/           # 粮仓/库存领域
  finance/             # 成本、采购事实、记账
  sync/                # 可选同步协议，不包含具体 UI
  ui/                  # 可复用纯 UI 组件
services/
  vision/
    ocr/                # PaddleOCR / OpenCV 等独立视觉进程
    detection/          # YOLO / segmentation 等
features/
  granary/              # 游戏化粮仓表现层
  collaboration/        # 聚餐协作
  multimodal/           # 后续 ASR / 多模态实验
```

### 7.2 剥离 Supabase：Repository / Storage Adapter

| ID | 临时任务 | 状态 | 完成定义 |
|---|---|---|---|
| V2-LOCAL-01 | 为主要业务定义 Repository interface | 待设计 | 例如 `RecipeRepository.save/get/list`、`InventoryRepository`、`DictionaryRepository`；业务 service 只认接口，不认 Supabase SDK。 |
| V2-LOCAL-02 | 把现有 Supabase 查询收口为 `Supabase*Repository` | 渐进执行 | 页面和业务规则不再散落 `.from("...")`；RLS 与云端事务继续保留，但被视为 Cloud Adapter。 |
| V2-LOCAL-03 | 设计本地 Repository | 待实验 | Web 可先用 IndexedDB/内存 adapter 验证接口；未来 Desktop 使用 SQLite，实现不开账号、不连接 Supabase 也能创建/编辑/搜索/备份菜谱与库存。 |
| V2-LOCAL-04 | 本地 ↔ 云端 Sync Adapter 契约 | 待设计，不在 V2 实施完整双向同步 | 同步是可选能力；明确 id、版本、updated_at、删除标记、冲突与重试规则，避免以后把 Supabase 当业务核心而无法离线。 |
| V2-LOCAL-05 | 本地备份/恢复格式 | 待设计 | SQLite/本地存储可导出稳定 JSON/ZIP 备份；图片与模型资源分开，不能让本地数据库因媒体或模型无限膨胀。 |

目标依赖：

```text
页面 / Desktop UI
      ↓
Domain Service
      ↓
Repository Port
   ┌──┴───────────┐
   ↓              ↓
Local Adapter   Supabase Adapter
SQLite/IDB      PostgreSQL/Storage
```

### 7.3 水杉式 Provider：本地优先、云端补全、结果可追溯

| ID | 临时任务 | 状态 | 完成定义 |
|---|---|---|---|
| V2-PROVIDER-01 | `TranslationProvider` 统一接口 | 待设计 | 腾讯/DeepL/Google/LLM/自定义 endpoint 或以后本地模型都返回统一 `TranslationCandidate`，业务层不绑定单一厂商。 |
| V2-PROVIDER-02 | 厨房词典优先级链 | 待设计 | `canonical dictionary → market alias → translation provider → 用户确认 → alias/词典提案`；API 用于补未知词，不替代已有 canonical 数据。 |
| V2-PROVIDER-03 | 翻译缓存与防抖 | 待设计 | 同一 source/target/provider/text 建缓存 key；短时间失败可做 negative cache；输入联想/批量 OCR 不应重复请求相同翻译。 |
| V2-PROVIDER-04 | 翻译结果持久化门禁 | 待设计 | 云端译文默认是候选；只有满足格式规则并经人工/审核确认后才能成为正式 alias，必须保存 provider、语言、时间和证据来源。 |
| V2-PROVIDER-05 | OCR / Vision / ASR Provider 契约统一原则 | 渐进执行 | 重模型只输出版本化 candidate/evidence；主程序不依赖某个具体 OCR/YOLO/ASR SDK，方便未来更换本地/云端实现。 |

### 7.4 Optional Module 与发行边界

| ID | 临时任务 | 状态 | 完成定义 |
|---|---|---|---|
| V2-MOD-01 | Core 与重功能依赖隔离 | 待设计 | 基础菜谱/词典/采购/库存不安装或不启动 OCR、YOLO、ASR、3D 也能完整运行；重依赖不能进入普通首屏 bundle。 |
| V2-MOD-02 | Build Profile 草案 | 待设计 | 同一代码库定义 `Core / Cloud / OCR / Vision / Full` 能力组合，不维护多套互相漂移的源码 fork。 |
| V2-MOD-03 | AI runtime 与模型资源外置 | 待设计 | 研究环境可使用 PyTorch/Paddle；最终用户优先使用 ONNX/轻量 runtime 或 sidecar，模型权重作为可选资源，不把训练环境塞进基础安装包。 |
| V2-MOD-04 | 游戏粮仓表现层与库存事实分离 | 待设计 | 2D/3D/图标只是 `inventory` 的视图；关闭游戏界面后库存数据仍可用，不让 Three.js/模型资源成为核心依赖。 |

### 7.5 开源身份与发行准备

| ID | 临时任务 | 状态 | 完成定义 |
|---|---|---|---|
| V2-OPEN-01 | 明确开源许可证 | 用户手工处理 | 根目录加入标准 `LICENSE`，README 标明 SPDX 名称；不自己改写许可证条款。第三方代码/模型/数据继续逐项记录许可证。 |
| V2-BRAND-01 | 产品身份系统 | 待设计 | 确定最终产品名/工程名关系、作者署名、Logo、App Icon、favicon、GitHub Release 图标与基础视觉规范；代码许可证与 Logo/品牌使用边界分开。 |
| V2-RELEASE-01 | 发行元数据统一 | 待设计 | `package.json`、桌面包、Git tag、CHANGELOG、GitHub Release 使用统一版本；未来可自动产出 Core 与可选能力清单。 |

## 8. 当前执行顺序

1. 用正式账号提交一组小红书多截图和一组长/缺边小票，运行本地 `queue-worker`，完成上传→识别→返回核验页闭环。
2. 用保留/删除混合的小票候选设计“确认并记账”事务，再决定哪些项目可选加入线上粮仓。
3. 继续用真实冰箱/台面/袋装照片校准 YOLO 契约；主程序只消费版本化 JSON。
4. 发布并实机验收 PWA 安装、离线边界和更新策略。
5. 开始词典分类、用户提案和管理员审核设计。
6. 按路由渐进拆分 `CookingProvider`，收尾公开互动、采购库存、成本与可靠性任务。
7. **临时架构工作不单独抢占主线**：每次修改词典、库存、Supabase 或 AI 接口时，优先按第 7 节的 Repository / Provider / Optional Module 边界落地；等 V2 主闭环稳定后再集中整理目录。

## 9. 当前发布门禁（只列未通过项）

- [ ] 普通用户 + 管理员完成公开审核、点赞和跨账号权限验收；
- [ ] 正式账号完成小红书截图和小票队列闭环；食材视觉仍保持“确认后才写正式数据”；
- [ ] 采购勾选、线上冰箱增加/用完/排除完成电脑 + 手机验收；
- [ ] PWA 安装、登录恢复、弱网/离线提示和版本更新通过；
- [x] 本次网页依赖的异步 OCR 队列 migration 已按 `03` 同步 PROD 并复核 RLS；
- [ ] Storage 图片完成 DEV 备份恢复演练；
- [ ] `package.json`、CHANGELOG、Git tag、GitHub commit 和 Sites 版本在正式发布时一致；
- [ ] `99` 中没有未分级的阻塞反馈。
