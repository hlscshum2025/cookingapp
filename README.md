# CookingApp-V2

把 B 站、下厨房、小红书和其他来源中真正值得保留的菜谱，整理成一个可搜索、可修改、可记录个人经验，并适合在德国实际采购和做饭使用的个人厨房知识系统。

**当前正式版本：CookingApp-V2（初步应用版）**  
V1 已结项，V1 的技术经验、历史范围、旧初始化步骤和验收记录统一归档到 [`docs/00_v1_technical_experience.md`](docs/00_v1_technical_experience.md)。V2 的历史工作流程记录在 [`docs/00_v2_development_history.md`](docs/00_v2_development_history.md)，当前任务统一看 [`docs/02_v2_workboard.md`](docs/02_v2_workboard.md)。

## 1. 当前产品定位

CookingApp-V2 不只是“收藏菜谱”，而是围绕实际做饭形成下面的闭环：

```text
外部来源
  ↓
来源待办 / 导入中心
  ↓
人工或半结构化整理
  ↓
个人菜谱版本
  ↓
采购 / 线上冰箱 / 成本
  ↓
厨房模式实际制作
  ↓
做菜日志与下一次改进
```

核心原则：

- 收藏不等于菜谱；来源和正式菜谱分开保存。
- 原始配方、个人版本和历次做菜日志分层保存。
- 未知克数、时间、火候不得由程序强行猜测。
- 德国采购、繁中地区词汇、OCR/AI 都通过稳定的 canonical 食材层接入。
- 任何 AI / OCR 自动结果默认是候选，关键业务数据需要保留证据与核验状态。
- 私人数据依靠 Supabase RLS 隔离，前端隐藏按钮不是权限边界。

## 2. V2 当前能力

### 菜谱与个人知识

- 菜谱搜索、筛选、详情、新建、编辑和删除
- 来源信息、当前个人版、历史版本和做菜日志分层
- 食材、步骤、份数、时间、难度、标签和厨具编辑
- 厨房模式：大字号步骤、逐步勾选、份量换算
- 成品图片与私有做菜日志图片
- 草稿、失败重试和来源追溯

### 多来源导入

- B 站收藏夹 JSON / BV 来源导入
- 统一 `SourceAdapter` / `SourceDraft`
- 下厨房单条菜谱半结构化导入
- 小红书分享链接 + 人工打开原页面 + 页面提取器
- 通用链接 / 粘贴文本入口
- 未可靠取得的字段保持待核验，不伪造数据

### 公开内容与账号

- 邮箱注册、确认、登录、找回密码和修改密码
- Cloudflare Turnstile
- 私人菜谱与公开菜谱分层
- 公开菜谱提交审核、白名单快照和只读公开数据
- 成品图封面、公开点赞与排序能力逐步完善
- 多账号 RLS 隔离和跨用户越权测试

### 采购与线上冰箱

- 多菜谱加入采购车
- 德国普通超市 / 亚超分类
- 已购买勾选、复制和 CSV 导出
- 账号级线上冰箱
- 已有库存自动排除采购项
- “用完了”二次确认
- V2 正在设计采购价格、包装净量、商店、成本快照和每人份成本

### 多语言与地区词汇

V2 不采用“只做简繁字符转换”的方案，而是建立地区化词汇层：

```text
canonical ingredient
  ├─ zh-CN
  ├─ zh-TW
  ├─ en
  ├─ de
  └─ market aliases / store aliases
```

目标包括：

- `zh-CN` / `zh-TW` UI
- 台湾地区厨房词汇
- 中英德食材词典
- 德国包装名、超市简称和替代品
- 不同语言或别名搜索同一个食材实体

## 3. V2 新增研究线：德国小票 OCR

V2 开始把机器视觉学习接入真实厨房业务，但**当前阶段不要求从零训练 OCR 模型**。

目标流水线：

```text
德国超市小票照片
  ↓
OpenCV 图像预处理
  ↓
OCR（先以 PaddleOCR 为服务端 baseline）
  ↓
商品行 / 数量 / 单位 / 价格解析
  ↓
德国商品名或缩写
  ↓
厨房词典 / market alias
  ↓
canonical ingredient_id
  ↓
用户核验
  ↓
采购记录 / 成本 / 可选加入线上冰箱
```

计划同时保留：

- Web 后端 Python vision service
- 未来原生 iOS 的 Apple Vision Adapter
- 未来 Android / iOS 的 ML Kit Adapter
- 统一 `ReceiptOcrDraft` 输出契约
- CORD v2 receipt parsing 学习与 benchmark

对应任务见 [`docs/02_v2_workboard.md`](docs/02_v2_workboard.md)，计划数据库结构见 [`docs/03_dev_prod_database_sync.md`](docs/03_dev_prod_database_sync.md)。

## 4. 后续版本

### V3｜图像自动化、库存提醒与并行厨房

- 视频关键帧 OCR
- 图片中的食材 / 字幕 / 用量候选提取
- 批量后台任务、断点续传和失败重试
- 库存购买日期、开封日期、保质期与临期提醒
- 手机 / 平板多菜谱并行厨房
- 灶台、锅具、烤箱和多人 / 多厨房调度

### V4｜语音识别、YOLO 与多模态 AI 研究

- 学习并接入 ASR，以 Whisper 类模型作为 baseline
- 视频语音转 timestamp transcript
- YOLO / 目标检测用于冰箱食材、商品、厨具、容器、价格标签等视觉目标
- 研究自建厨房目标检测数据集、标注、训练、验证和部署
- 把 ASR、字幕、OCR、目标检测和原始来源对齐到同一时间轴 / 实体
- 做证据融合、冲突检测和可追溯结构化，而不是让单一模型覆盖原始证据

完整版本规划见 [`docs/01_product_roadmap.md`](docs/01_product_roadmap.md)。

## 5. 技术架构

```text
Next.js / React / TypeScript
          │
          ├─ Supabase Auth
          ├─ Supabase PostgreSQL
          ├─ Supabase Storage
          ├─ RLS / RPC / migrations
          │
          ├─ Source Adapters
          │    ├─ Bilibili
          │    ├─ 下厨房
          │    ├─ 小红书
          │    └─ Generic
          │
          └─ 后续独立 Python AI services
               ├─ OpenCV
               ├─ PaddleOCR
               ├─ YOLO
               └─ ASR / multimodal research
```

生产代码与数据库迁移保存在 GitHub；正式业务数据保存在 Supabase。B 站等平台的视频本体不复制到仓库，只保存必要来源信息和用户整理结果。

## 6. 项目结构

```text
app/                         Next.js 页面与路由
components/                  可复用 UI / 业务组件
lib/                         数据类型、客户端与业务服务
public/tools/                浏览器端辅助提取工具
supabase/migrations/         数据库结构变更
supabase/checks/             数据库只读检查
supabase/tests/              RLS / 权限测试
tests/                       应用级自动测试
tools/                       本地来源导出工具
docs/                        版本路线图、经验和操作文档
.openai/hosting.json         Sites 项目关联
```

未来视觉研究代码预计独立放在：

```text
services/
  vision/
    pyproject.toml
    receipt_ocr/
      preprocess.py
      ocr.py
      parser.py
      schema.py
      main.py
```

Python 项目并不强制必须有 `main.py`；这个文件只作为我们未来 vision service 的一个入口命名建议。

## 7. Windows 本地运行 Web

安装 Node.js 22 LTS 和 Git，然后：

```powershell
git clone https://github.com/hlscshum2025/cookingapp.git
cd cookingapp
copy .env.example .env.local
npm install
npm run dev
```

如果已经 clone：

```powershell
cd cookingapp
git pull
npm install
npm run dev
```

`.env.local` 至少需要对应环境的 Supabase URL 和 Publishable key。Secret、`service_role`、数据库密码和 Cookie 不得提交到 GitHub。

正式开发约定：

- localhost 使用 DEV Supabase
- Sites 正式站使用 PROD Supabase
- 数据库结构先在 DEV 验证
- 发布前读取 `docs/03_dev_prod_database_sync.md`
- 不使用 DEV 整库覆盖 PROD

## 8. Python 视觉实验环境

视觉研究与 Next.js 的 npm 环境分开管理。例如在仓库根目录：

```powershell
python -m venv .venv-vision
.venv-vision\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install opencv-python numpy
```

后续再按实验需要安装 PaddleOCR、PyTorch 或 Ultralytics YOLO。第三方 Python 包安装在虚拟环境中，不直接复制进 `scripts/` 或 `services/` 目录。

## 9. 数据库与发布规则

任何新增表、字段、索引、约束、RLS、Trigger 或 Function 都遵循：

```text
设计
 ↓
GitHub migration
 ↓
DEV 执行与测试
 ↓
docs/03 记录为待同步
 ↓
同步 PROD
 ↓
权限 / RLS 复核
 ↓
Sites 发布
 ↓
实机验收
```

当前 V2 的小票 OCR 表仍处于设计阶段，没有因为文档更新而直接修改 PROD。

## 10. 关键文档

- [`docs/00_v1_technical_experience.md`](docs/00_v1_technical_experience.md)：V1 结项、历史操作和技术经验
- [`docs/00_v2_development_history.md`](docs/00_v2_development_history.md)：V2 实际研发顺序、方案变化和经验沉淀
- [`docs/01_product_roadmap.md`](docs/01_product_roadmap.md)：全生命周期版本路线图
- [`docs/02_v2_workboard.md`](docs/02_v2_workboard.md)：V2 当前实际任务和验收状态
- [`docs/03_dev_prod_database_sync.md`](docs/03_dev_prod_database_sync.md)：DEV / PROD 数据库差异与发布门禁
- [`docs/99_feedback_and_adjustments.md`](docs/99_feedback_and_adjustments.md)：使用反馈和待分级调整
- [`docs/ADMIN_GUIDE.md`](docs/ADMIN_GUIDE.md)：管理员操作指南
- [`docs/CODE_GUIDE.md`](docs/CODE_GUIDE.md)：代码、本地运行和 npm 说明
- [`docs/database_schema.md`](docs/database_schema.md)：数据库设计背景

## 11. V1 历史归档

V1 不再作为 README 的当前产品说明。以下内容已经或将持续归档到 [`docs/00_v1_technical_experience.md`](docs/00_v1_technical_experience.md)：

- 从 0 到 V1 的里程碑与范围调整
- V1 初始 Supabase 安装和 migration 顺序
- V1 的登录 / 导入 / 云端写入验收流程
- 10 条真实菜谱闭环与第二账号权限验收
- V1 的分享、安全、RLS、备份恢复、Sites 发布经验
- 被 V2/V3 替代或延期的旧方案

从现在开始，README 只描述 **CookingApp-V2 当前基线和未来版本入口**，不再把历史 V1 功能状态当成当前待办。
