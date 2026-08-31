# CookingApp 视觉识别实验框架

这个目录用于本地学习和实验，不会直接连接或写入 Supabase。当前已经预留三条路线：

1. 德国小票：OpenCV 预处理 → PaddleOCR → 商品行候选 → `ReceiptOcrDraft` JSON；
2. 冰箱、桌面和袋装食材：YOLO-World 开放词汇检测 → `VisionCandidate` JSON；
3. 后续融合：视觉、OCR、条码、重量证据合并，但冲突时必须保留 `unknown` 并等待人工确认。

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

# 冰箱照片
cooking-vision detect data\raw\fridge\fridge.jpg --scene fridge --output outputs\fridge.json

# 桌面照片
cooking-vision detect data\raw\tabletop\food.jpg --scene tabletop --output outputs\tabletop.json

# 袋装食材
cooking-vision detect data\raw\bagged\bag.jpg --scene bagged --output outputs\bagged.json
```

也可以在 PyCharm 建立 Python Run Configuration：Module name 填 `cooking_vision.cli`，Parameters 填上面命令中 `preprocess`、`receipt` 或 `detect` 后面的部分。

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
