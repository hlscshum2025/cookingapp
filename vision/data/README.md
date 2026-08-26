# 本地数据目录

`raw/receipts`、`raw/fridge`、`raw/tabletop`、`raw/bagged` 用于个人实验图片。真实小票可能包含姓名、会员号、支付信息、时间和地点；不要提交 GitHub，也不要未经清理上传公共数据集。

以后建立标注集时使用 `dataset/images/{train,val,test}` 与 `dataset/labels/{train,val,test}`，并按拍摄场景或拍摄批次分组切分，避免同一连拍序列同时进入训练集和验证集。
