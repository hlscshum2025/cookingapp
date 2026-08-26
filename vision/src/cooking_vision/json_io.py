from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def write_json(payload:dict[str,Any]|list[dict[str,Any]],destination:str|Path)->Path:
    path=Path(destination)
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(payload,ensure_ascii=False,indent=2),encoding="utf-8")
    return path
