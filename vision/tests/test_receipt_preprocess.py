import numpy as np

from cooking_vision.receipt.preprocess import _resize


def test_long_receipt_keeps_readable_width():
    image=np.zeros((5200,1080,3),dtype=np.uint8)

    resized=_resize(image,2200)

    assert resized.shape[1]>=960
    assert resized.shape[0]>2200
