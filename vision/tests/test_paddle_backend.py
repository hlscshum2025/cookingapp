from __future__ import annotations

import sys
from types import ModuleType

import numpy as np
import pytest

from cooking_vision.receipt.paddle_backend import _ensure_three_channel_image,_load_pipeline


@pytest.fixture(autouse=True)
def clear_pipeline_cache():
    _load_pipeline.cache_clear()
    yield
    _load_pipeline.cache_clear()


def test_grayscale_image_is_expanded_to_three_channels():
    grayscale=np.arange(20,dtype=np.uint8).reshape(4,5)

    result=_ensure_three_channel_image(grayscale)

    assert result.shape==(4,5,3)
    assert result.flags.c_contiguous
    assert np.array_equal(result[:,:,0],grayscale)
    assert np.array_equal(result[:,:,1],grayscale)
    assert np.array_equal(result[:,:,2],grayscale)


def test_four_channel_image_has_alpha_removed():
    bgra=np.zeros((3,4,4),dtype=np.uint8)

    result=_ensure_three_channel_image(bgra)

    assert result.shape==(3,4,3)


def test_invalid_image_shape_has_clear_error():
    with pytest.raises(ValueError,match="H x W x 3"):
        _ensure_three_channel_image(np.zeros((4,),dtype=np.uint8))


def test_cpu_pipeline_disables_mkldnn(monkeypatch):
    calls=[]
    fake_module=ModuleType("paddleocr")
    fake_module.__version__="3.7.0"

    class FakePaddleOCR:
        def __init__(self,**options):
            calls.append(options)

    fake_module.PaddleOCR=FakePaddleOCR
    monkeypatch.setitem(sys.modules,"paddleocr",fake_module)

    _load_pipeline("german","cpu")

    assert calls[0]["enable_mkldnn"] is False


def test_non_cpu_pipeline_leaves_mkldnn_setting_to_backend(monkeypatch):
    calls=[]
    fake_module=ModuleType("paddleocr")
    fake_module.__version__="3.7.0"

    class FakePaddleOCR:
        def __init__(self,**options):
            calls.append(options)

    fake_module.PaddleOCR=FakePaddleOCR
    monkeypatch.setitem(sys.modules,"paddleocr",fake_module)

    _load_pipeline("german","gpu:0")

    assert "enable_mkldnn" not in calls[0]
