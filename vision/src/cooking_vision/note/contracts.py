from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any, Literal

from cooking_vision.contracts import BoundingBox, OcrTextLine, utc_now_iso


VerificationStatus = Literal["unverified", "user_verified", "rejected"]
ScreenshotCropMode = Literal["auto", "full", "right"]
AppliedCropMode = Literal["full", "right"]


@dataclass(frozen=True)
class NoteIngredientCandidate:
    raw_text: str
    name: str | None = None
    amount_text: str | None = None
    verification_status: VerificationStatus = "unverified"


@dataclass(frozen=True)
class NoteStepCandidate:
    raw_text: str
    order: int | None = None
    verification_status: VerificationStatus = "unverified"


@dataclass
class NoteOcrPage:
    source_image: str
    input_index: int
    crop_mode: AppliedCropMode
    crop_bbox: BoundingBox
    image_width: int
    image_height: int
    lines: list[OcrTextLine] = field(default_factory=list)
    raw_result: dict[str, Any] = field(default_factory=dict)
    latency_ms: int | None = None


@dataclass
class RecipeScreenshotDraft:
    source_images: list[str]
    provider: str
    model_version: str
    source_platform: str = "xiaohongshu"
    preprocess_version: str = "note-screenshot-v1"
    schema_version: str = "recipe-screenshot-draft-v1"
    created_at: str = field(default_factory=utc_now_iso)
    pages: list[NoteOcrPage] = field(default_factory=list)
    merged_text_lines: list[str] = field(default_factory=list)
    title: str | None = None
    author: str | None = None
    description: str | None = None
    ingredients: list[NoteIngredientCandidate] = field(default_factory=list)
    steps: list[NoteStepCandidate] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    raw_result: dict[str, Any] = field(default_factory=dict)
    latency_ms: int | None = None
    confirmed: bool = False

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)
