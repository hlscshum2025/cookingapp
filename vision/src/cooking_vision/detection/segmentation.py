from __future__ import annotations

from pathlib import Path
from typing import Protocol

from cooking_vision.contracts import SceneType, VisionCandidate


class SegmentationBackend(Protocol):
    """Slot for YOLO segmentation, YOLOE segmentation or SAM experiments."""

    def segment(self,image_path:str|Path,scene:SceneType)->list[VisionCandidate]: ...


def estimate_visible_instance_count(candidates:list[VisionCandidate])->dict[str,int]:
    """Count visible boxes only; occluded or bagged quantities remain unknown."""
    counts:dict[str,int]={}
    for candidate in candidates:
        counts[candidate.label]=counts.get(candidate.label,0)+1
    return counts
