# CookingApp 视觉识别实验框架

这个目录用于本地学习和实验，不会直接连接或写入 Supabase。当前已经预留三条路线：

1. 德国小票：OpenCV 预处理 → PaddleOCR → 商品行候选 → `ReceiptOcrDraft` JSON；
2. 冰箱、桌面和袋装食材：YOLO-World 开放词汇检测 → `VisionCandidate` JSON；
3. 后续融合：视觉、OCR、条码、重量证据合并，但冲突时必须保留 `unknown` 并等待人工确认。

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
cooking-vision receipt-batch data\\raw\\receipts --output outputs\\receipt-batch

# 调试图像预处理时额外保存每张小票的中间图
cooking-vision receipt-batch data\\raw\\receipts --output outputs\\receipt-batch --save-stages

# 冰箱照片
cooking-vision detect data\raw\fridge\fridge.jpg --scene fridge --output outputs\fridge.json

# 桌面照片
cooking-vision detect data\raw\tabletop\food.jpg --scene tabletop --output outputs\tabletop.json

# 袋装食材
cooking-vision detect data\raw\bagged\bag.jpg --scene bagged --output outputs\bagged.json
```

也可以在 PyCharm 建立 Python Run Configuration：Module name 填 `cooking_vision.cli`，Parameters 填上面命令中 `preprocess`、`receipt` 或 `detect` 后面的部分。

## 当前代码边界

- 已实现：Unicode 路径读取、缩放、灰度/CLAHE、去噪、二值化、票据轮廓与透视矫正、PaddleOCR 3.x 结果适配、基础价格/数量候选解析、YOLO-World 自定义类别检测、统一 JSON 契约。
- OCR 候选还包含：同行商品名/价格框合并、商店/日期/时间/总额候选、多件装与单价解析、批量 JSON 和 CSV 汇总。
- 已留接口：商品别名映射、实例分割、条码、重量、跨帧去重、precision/recall 评估、Supabase 人工核验写入。
- 尚未完成：真实德国小票与冰箱照片的误差统计。没有真实样本结果前，任何候选都不能自动写库存、采购或成本。

运行轻量测试：

```powershell
python -m pytest
```
