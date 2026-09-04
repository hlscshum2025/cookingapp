# CookingApp 视觉识别实验框架

## OCR worker（第一版）

当前默认采用“Sites 上传到 Supabase 私有队列，管理员电脑按需处理”的方式。
网页不需要直接访问管理员电脑，也不需要为 PaddleOCR 单独购买一台 24 小时在线
的云服务器：用户可以先提交图片并关闭页面，管理员之后启动本地 worker，结果写回
同一条账号隔离的任务，用户再次打开导入中心或饮食记账即可继续核对。

本地 worker 需要服务器端密钥，因此只能在管理员电脑或受信服务器运行。密钥不得
写入 Git、Sites 环境变量或任何 `NEXT_PUBLIC_` 变量。PowerShell 示例：

```powershell
$env:SUPABASE_URL="https://你的项目.supabase.co"
$env:SUPABASE_SECRET_KEY="你的 sb_secret_... 密钥"
python -m cooking_vision.cli queue-worker
```

只处理队列中至多一个任务后退出：

```powershell
python -m cooking_vision.cli queue-worker --once
```

Sites 已发布时不需要同时运行 `npm`；只有本地开发网页时才在另一个终端运行
`npm run dev`。worker 在一个进程内复用 PaddleOCR 模型：第一次任务有模型冷启动，
之后同语言、同设备的任务不会重复加载模型。

若以后需要秒级自动响应，可把同一 worker 部署为长期运行的容器，并将
`NEXT_PUBLIC_OCR_TRANSPORT=direct`。此时至少配置 `SUPABASE_URL`、
`SUPABASE_PUBLISHABLE_KEY`、精确的 `VISION_ALLOWED_ORIGINS` 和
`VISION_API_URL`；不要在正式环境启用 `VISION_DEV_ALLOW_UNAUTHENTICATED`。

```bash
python -m pip install -r requirements/service-cpu.txt
export VISION_DEV_ALLOW_UNAUTHENTICATED=1
export VISION_ALLOWED_ORIGINS=http://localhost:3000
uvicorn cooking_vision.service:app --host 127.0.0.1 --port 8000
```

以下 `uvicorn` 命令只用于 direct 模式的本地联调。正式环境不要设置
`VISION_DEV_ALLOW_UNAUTHENTICATED=1`，而应设置
`SUPABASE_URL`、`SUPABASE_PUBLISHABLE_KEY` 和严格的
`VISION_ALLOWED_ORIGINS`。接口接受1–12张有序图片，立即返回任务ID，网页轮询：

- `POST /v1/ocr/jobs?kind=receipt`
- `POST /v1/ocr/jobs?kind=xiaohongshu`
- `GET /v1/ocr/jobs/{job_id}`

任务状态依次为 `queued → running → review_required`，失败则为 `failed`。
direct 模式的任务表仍是单进程内存实现，只适合本地联调；默认 queue 模式使用
Supabase 持久任务表和私有 `ocr-inputs` bucket。两种模式都只返回待确认草稿，
不会自动写入粮仓、记账或正式菜谱。

除 `queue-worker` 外，这个目录中的单图、批处理和 demo 命令只在本地读写文件。
当前已经预留三条路线：

1. 德国小票：OpenCV 预处理 → PaddleOCR → 商品行候选 → `ReceiptOcrDraft` JSON；
2. 小红书菜谱截图：截图文字区裁剪 → 中文 OCR → 多图去重合并 → 菜谱候选 JSON；
3. 冰箱、桌面和袋装食材：YOLO-World 开放词汇检测 → `VisionCandidate` JSON；
4. 后续融合：视觉、OCR、条码、重量证据合并，但冲突时必须保留 `unknown` 并等待人工确认。

小票 OCR、批处理与诊断功能已经合入 `main`；本地运行前请先拉取最新 `main`。

## PyCharm 建议环境

推荐安装 **64 位 Python 3.11**。OCR 和 YOLO 分成两个虚拟环境，避免 PaddleOCR 自带的 OpenCV 与 Ultralytics 的 OpenCV 包互相覆盖。

### A. 小票 OCR 环境

在 PyCharm 中打开仓库的 `vision` 文件夹，然后在 Terminal 运行：

```powershell
py -3.11 -m venv .venv-ocr
.\.venv-ocr\Scripts\Activate.ps1
python -m pip install --upgrade pip setuptools wheel
python -m pip install -r requirements\ocr-cpu.txt
python -m pip install -r requirements\dev.txt
python -m pip install -e .
```

在 PyCharm 的 `Settings → Project → Python Interpreter` 选择：

```text
vision\.venv-ocr\Scripts\python.exe
```

首次运行会下载 PaddleOCR 模型，需要让 PyCharm/终端经过可访问模型源的网络。

### B. 食材检测环境

```powershell
py -3.11 -m venv .venv-vision
.\.venv-vision\Scripts\Activate.ps1
python -m pip install --upgrade pip setuptools wheel
python -m pip install -r requirements\vision-cpu.txt
python -m pip install -r requirements\dev.txt
python -m pip install -e .
```

然后把 PyCharm Interpreter 切换为：

```text
vision\.venv-vision\Scripts\python.exe
```

首次运行会下载 `yolov8s-worldv2.pt`。CPU 可以运行但速度较慢；确认流程正确后再单独配置 NVIDIA GPU 版 PyTorch。

## 直接运行

先把私人照片放到 `data/raw/` 对应目录。图片、模型和输出默认不会提交 GitHub。

```powershell
# 只看 OpenCV 预处理结果
cooking-vision preprocess data\raw\receipts\receipt.jpg --output outputs\receipt-preprocess

# 德国小票 OCR，输出可人工核验的 JSON
cooking-vision receipt data\raw\receipts\receipt.jpg --output outputs\receipt.json

# 批量处理整个小票目录；重用同一个 PaddleOCR 实例并生成 summary.csv
cooking-vision receipt-batch data\raw\receipts --output outputs\receipt-batch

# 调试图像预处理时额外保存每张小票的中间图
cooking-vision receipt-batch data\raw\receipts --output outputs\receipt-batch --save-stages

# 一张小红书菜谱截图
cooking-vision xiaohongshu data\raw\xiaohongshu\recipe-01.png --output outputs\xiaohongshu-recipe.json

# 多张截图按给出的先后顺序组成同一个菜谱
cooking-vision xiaohongshu data\raw\xiaohongshu\recipe-01.png data\raw\xiaohongshu\recipe-02.png data\raw\xiaohongshu\recipe-03.png --output outputs\xiaohongshu-recipe.json --stages outputs\xiaohongshu-stages

# 冰箱照片
cooking-vision detect data\raw\fridge\fridge.jpg --scene fridge --output outputs\fridge.json

# 桌面照片
cooking-vision detect data\raw\tabletop\food.jpg --scene tabletop --output outputs\tabletop.json

# 袋装食材
cooking-vision detect data\raw\bagged\bag.jpg --scene bagged --output outputs\bagged.json
```

也可以在 PyCharm 建立 Python Run Configuration：Module name 填 `cooking_vision.cli`，Parameters 填上面命令中 `preprocess`、`receipt`、`xiaohongshu` 或 `detect` 后面的部分。

## 小红书菜谱截图 OCR demo

```text
一张或多张截图
→ 自动选择整图或右侧文字面板
→ PaddleOCR 中文文字检测与识别
→ 按截图顺序合并
→ 仅在相邻截图边界消除重复文字
→ 查找食材、材料、用料、做法和步骤等标题
→ 输出等待人工确认的菜谱草稿
```

多张图片的位置参数属于同一个菜谱，顺序必须与正文从前到后相同。程序不会根据文件名自动猜顺序。

默认 `--crop-mode auto`：

- 桌面横图右侧存在明显深色文字面板时，只把右侧送进 OCR；
- 普通手机竖屏截图使用整图；
- 浅色桌面布局没有自动分栏时，可手动使用 `--crop-mode right --right-ratio 0.42`；
- 若自动裁剪错误，可使用 `--crop-mode full` 强制识别整图。

输出中的 `title`、`ingredients` 和 `steps` 都是候选值，默认保持 `unverified`。截图没有包含标题、用量或完整步骤时，对应字段保持空值并产生 warning，不会自行补全。原始截图、调试图和 JSON 都只保存在本地，本命令不会写入 Supabase。

## 批处理的输入、输出与日志

手动创建 `outputs\receipt-batch` 只是在准备**输出目录**，不会让程序得到待识别图片。请把 `.jpg`、`.jpeg`、`.png`、`.bmp`、`.tif`、`.tiff` 或 `.webp` 图片放入：

```text
vision/data/raw/receipts/
```

命令启动后会立即显示输入目录、输出目录、找到的图片数和逐张进度。默认输出结构是：

```text
outputs/receipt-batch/
├── summary.csv
├── json/
│   └── 每张小票一个同名 JSON
├── logs/
│   ├── batch.log
│   └── errors.log
└── stages/                 # 只有使用 --save-stages 才生成
    └── 每张小票的预处理图/
```

- `summary.csv`：一行对应一张输入图，包含成功/失败、文本行数、商品候选数、耗时、JSON 路径和简短错误。
- `json/`：可供人工核验或后续 API 转换的完整 `ReceiptOcrDraft`。
- `logs/batch.log`：本次运行的启动参数、逐张进度和最终统计。
- `logs/errors.log`：失败图片的异常类型与完整 traceback；没有失败时会写明“本次运行没有失败记录”。
- `stages/`：灰度、二值化、透视矫正等调试图片，不是业务结果，不应上传数据库。

一次正常运行的终端输出大致如下：

```text
开始小票 OCR 批处理
输入目录：D:\cookingapp\vision\data\raw\receipts
输出目录：D:\cookingapp\vision\outputs\receipt-batch
找到支持的图片：3 张
[1/3] 正在处理：rewe-001.jpg
[1/3] 成功：OCR 文本行 28，商品候选 9，耗时 4210 ms
...
批处理完成：共 3 张，成功 2 张，失败 1 张。
汇总文件：...\summary.csv
运行日志：...\logs\batch.log
错误日志：...\logs\errors.log
```

首次处理第一张图会初始化或下载 PaddleOCR 模型，可能明显慢于后续图片。先用下面命令检查当前环境：

```powershell
python -c "import sys; print(sys.executable)"
python -m cooking_vision.cli environment
python -m cooking_vision.cli receipt-batch data\raw\receipts --output outputs\receipt-batch --save-stages
```

结果应按下面区分：

| 现象 | 含义 | 检查位置 |
|---|---|---|
| `receipt-batch` 不是可用命令 | 本地代码未拉取最新 `main`，或 editable install 指向了别处 | `git status`、`git pull` 和 `cooking_vision.__file__` |
| 找到图片 `0` 张 | 输入目录错误、目录为空或扩展名不支持 | 终端显示的“输入目录” |
| `paddleocr` / `paddlepaddle: not installed` | OCR 运行库没有装进当前解释器 | `environment` 输出 |
| 第一张图长时间停留 | 通常在加载或首次下载模型 | 网络和 PaddleOCR 自身日志 |
| `ConvertPirAttribute2RuntimeAttribute` / `onednn_instruction.cc` | PaddlePaddle 3.3.x 的 CPU oneDNN/MKLDNN 推理回归 | 拉取最新 `main`；代码会在 CPU 上使用 `enable_mkldnn=False` 绕开该后端 |
| 状态成功，但 OCR 文本行为 `0` | 模型运行了，但没有高于阈值的文字结果 | 对应 JSON 的 `warnings` 和 `raw_result` |
| 有 OCR 文本行，但商品候选为 `0` | 识别到了字，当前规则没有找到商品名＋价格行 | 对应 JSON 的 `lines` 与 `warnings` |
| 状态失败 | 代码、依赖、图片读取或模型调用抛出异常 | `logs/errors.log` |

若怀疑 editable install 指错了项目，可运行：

```powershell
python -c "import cooking_vision; print(cooking_vision.__file__)"
```

路径应位于当前 `D:\cookingapp\vision\src\cooking_vision` 下。

## 代码目录与建议阅读顺序

```text
vision/
├── configs/                       参数与类别配置
├── data/raw/                      本地私人样本，不提交 Git
├── models/                        模型说明；大权重不提交普通 Git
├── outputs/                       本地结果与日志，不提交 Git
├── requirements/                  OCR、YOLO、开发依赖
├── src/cooking_vision/
│   ├── cli.py                     命令行入口
│   ├── contracts.py               OCR/视觉统一数据结构
│   ├── json_io.py                 JSON 写入
│   ├── receipt/
│   │   ├── preprocess.py          OpenCV 预处理与透视矫正
│   │   ├── paddle_backend.py      PaddleOCR 初始化和结果适配
│   │   ├── parser.py              文本行合并、元数据和商品候选解析
│   │   ├── pipeline.py            串起预处理、OCR 和解析
│   │   └── batch.py               批量遍历、进度、CSV 和日志
│   ├── detection/                 YOLO 食材检测
│   └── fusion/                    多种识别证据的后续融合
├── tests/                         不依赖真实私人图片的单元测试
└── pyproject.toml                 Python 版本、包名和命令入口
```

建议从一张小票的调用链开始读：

1. `cli.py` 中的 `receipt` / `receipt-batch` 分支，了解参数从哪里进入；
2. `receipt/pipeline.py` 的 `build_receipt_draft()`，先看完整数据流；
3. `receipt/preprocess.py`，结合 `--save-stages` 的图片学习 OpenCV；
4. `receipt/paddle_backend.py`，看模型怎样初始化、怎样把 PaddleOCR 结果转成统一文本框；
5. `receipt/parser.py`，逐个修改德国商店、日期、总价和商品行规则；
6. `contracts.py`，理解最终 JSON 为什么这样组织；
7. `receipt/batch.py` 和 `tests/`，学习批处理、异常隔离和回归验证。

## 当前代码边界

- 已实现：Unicode 路径读取、缩放、灰度/CLAHE、去噪、二值化、票据轮廓与透视矫正、PaddleOCR 3.x 结果适配、基础价格/数量候选解析、YOLO-World 自定义类别检测、统一 JSON 契约。
- OCR 候选还包含：同行商品名/价格框合并、商店/日期/时间/总额候选、多件装与单价解析、批量 JSON 和 CSV 汇总。
- 已留接口：商品别名映射、实例分割、条码、重量、跨帧去重、precision/recall 评估、Supabase 人工核验写入。
- 尚未完成：真实德国小票与冰箱照片的误差统计。没有真实样本结果前，任何候选都不能自动写库存、采购或成本。

运行轻量测试：

```powershell
python -m pytest
```
