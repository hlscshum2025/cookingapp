from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import cast

import cv2
import numpy as np

from cooking_vision.contracts import BoundingBox
from cooking_vision.note.contracts import AppliedCropMode, ScreenshotCropMode
from cooking_vision.receipt.preprocess import read_image, write_image


@dataclass
class ScreenshotPreprocessResult:
    original: np.ndarray
    normalized: np.ndarray
    ocr_image: np.ndarray
    crop_bbox: BoundingBox
    crop_mode: AppliedCropMode


def _resize(image: np.ndarray, max_side: int) -> np.ndarray:
    if max_side <= 0:
        raise ValueError("max_side must be positive")
    height, width = image.shape[:2]
    longest = max(height, width)
    if longest <= max_side:
        return image.copy()
    scale = max_side / longest
    return cv2.resize(
        image,
        (round(width * scale), round(height * scale)),
        interpolation=cv2.INTER_AREA,
    )


def _dark_right_panel_start(image: np.ndarray) -> int | None:
    """Find a desktop-style dark text panel occupying the right side.

    A normal mobile screenshot often uses the whole width, so it deliberately
    stays in full-image mode. Light-theme or unusual layouts can use the
    explicit right crop mode as a fallback.
    """
    height, width = image.shape[:2]
    if width < 480 or height < 240:
        return None

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    profile = np.median(gray, axis=0).astype(np.float64)
    window = max(8, round(width * 0.018))
    cumulative = np.concatenate(([0.0], np.cumsum(profile)))

    search_start = max(window, round(width * 0.35))
    search_stop = min(width - window, round(width * 0.78))
    if search_stop <= search_start:
        return None

    candidates = np.arange(search_start, search_stop)
    left_means = (
        cumulative[candidates] - cumulative[candidates - window]
    ) / window
    right_means = (
        cumulative[candidates + window] - cumulative[candidates]
    ) / window
    contrasts = left_means - right_means
    best_offset = int(np.argmax(contrasts))
    start = int(candidates[best_offset])

    panel_width_ratio = (width - start) / width
    right_region = gray[:, start:]
    contrast = float(contrasts[best_offset])
    dark_fraction = float(np.mean(right_region < 80))
    right_median = float(np.median(right_region))

    if not 0.28 <= panel_width_ratio <= 0.65:
        return None
    if contrast < 45 or dark_fraction < 0.55 or right_median > 105:
        return None

    return max(0, start - max(2, round(width * 0.004)))


def preprocess_note_screenshot(
    path: str | Path,
    *,
    max_side: int = 2200,
    crop_mode: ScreenshotCropMode = "auto",
    right_ratio: float = 0.42,
) -> ScreenshotPreprocessResult:
    if crop_mode not in {"auto", "full", "right"}:
        raise ValueError(f"Unsupported crop mode: {crop_mode}")
    if not 0.20 <= right_ratio <= 0.80:
        raise ValueError("right_ratio must be between 0.20 and 0.80")

    original = read_image(path)
    normalized = _resize(original, max_side)
    height, width = normalized.shape[:2]

    crop_start: int | None = None
    if crop_mode == "auto":
        crop_start = _dark_right_panel_start(normalized)
    elif crop_mode == "right":
        crop_start = round(width * (1.0 - right_ratio))

    if crop_start is None:
        applied_mode: AppliedCropMode = "full"
        ocr_image = normalized.copy()
        crop_bbox = BoundingBox(0.0, 0.0, float(width), float(height))
    else:
        applied_mode = "right"
        crop_start = min(max(0, crop_start), width - 1)
        ocr_image = normalized[:, crop_start:].copy()
        crop_bbox = BoundingBox(
            float(crop_start),
            0.0,
            float(width),
            float(height),
        )

    return ScreenshotPreprocessResult(
        original=original,
        normalized=normalized,
        ocr_image=ocr_image,
        crop_bbox=crop_bbox,
        crop_mode=cast(AppliedCropMode, applied_mode),
    )


def save_note_stages(
    result: ScreenshotPreprocessResult,
    output_dir: str | Path,
) -> list[Path]:
    directory = Path(output_dir)
    return [
        write_image(directory / "01_original.jpg", result.original),
        write_image(directory / "02_normalized.jpg", result.normalized),
        write_image(directory / "03_ocr_region.jpg", result.ocr_image),
    ]
