from __future__ import annotations

import re
from dataclasses import dataclass
from difflib import SequenceMatcher
from typing import Iterable

from cooking_vision.note.contracts import (
    NoteIngredientCandidate,
    NoteStepCandidate,
)


INGREDIENT_HEADING = re.compile(
    r"^[^\w\u4e00-\u9fff]*(?:食材准备|食材清单|准备食材|食材|用料|材料)\s*[:：]?\s*(.*)$"
)
STEP_HEADING = re.compile(
    r"^[^\w\u4e00-\u9fff]*(?:做法步骤|制作步骤|烹饪步骤|做法|步骤)\s*[:：]?\s*(.*)$"
)
STOP_HEADING = re.compile(
    r"^[^\w\u4e00-\u9fff]*(?:好吃小技巧|烹饪小技巧|小贴士|小技巧|"
    r"美味小贴士|注意事项|温馨提示|成品展示|话题)\b"
)
NUMBERED_STEP = re.compile(
    r"^[^\w\u4e00-\u9fff]*(?:第\s*)?([1-9]\d*)\s*(?:步|[.、:：]|\s)\s*(.+)$"
)
CIRCLED_STEP = re.compile(r"^\s*([①②③④⑤⑥⑦⑧⑨⑩])\s*(.+)$")
AMOUNT_START = re.compile(
    r"(?:大约|约|小半|半|适量|少许|若干|\d+(?:\.\d+)?)"
)
PREFIX_AMOUNT = re.compile(
    r"^(?P<amount>(?:大约|约)?\d+(?:\.\d+)?\s*"
    r"(?:克|千克|kg|g|毫升|ml|升|l|根|个|只|勺|小勺|大勺|碗|杯|片|瓣|颗|包|盒|斤))"
    r"(?P<name>.+)$",
    re.IGNORECASE,
)
CIRCLED_NUMBERS = {
    "①": 1,
    "②": 2,
    "③": 3,
    "④": 4,
    "⑤": 5,
    "⑥": 6,
    "⑦": 7,
    "⑧": 8,
    "⑨": 9,
    "⑩": 10,
}


@dataclass(frozen=True)
class ParsedRecipeText:
    title: str | None
    author: str | None
    description: str | None
    ingredients: list[NoteIngredientCandidate]
    steps: list[NoteStepCandidate]


def clean_ocr_text(text: str) -> str:
    return " ".join(
        text.replace("\u3000", " ").replace("\xa0", " ").strip().split()
    )


def _match_key(text: str) -> str:
    return re.sub(r"[\W_]+", "", clean_ocr_text(text), flags=re.UNICODE).lower()


def _line_similarity(left: str, right: str) -> float:
    left_key = _match_key(left)
    right_key = _match_key(right)
    if not left_key or not right_key:
        return 0.0
    return SequenceMatcher(None, left_key, right_key).ratio()


def merge_page_lines(
    pages: Iterable[Iterable[str]],
    *,
    max_overlap_lines: int = 15,
) -> tuple[list[str], list[int]]:
    """Merge ordered screenshots and remove only boundary overlaps."""
    merged: list[str] = []
    removed_per_page: list[int] = []

    for page in pages:
        current = [
            cleaned
            for item in page
            if (cleaned := clean_ocr_text(item))
        ]
        if not merged:
            merged.extend(current)
            removed_per_page.append(0)
            continue

        best_overlap = 0
        limit = min(max_overlap_lines, len(merged), len(current))
        for size in range(limit, 0, -1):
            previous = merged[-size:]
            incoming = current[:size]
            scores = [
                _line_similarity(left, right)
                for left, right in zip(previous, incoming)
            ]
            exact = all(
                _match_key(left) == _match_key(right)
                for left, right in zip(previous, incoming)
            )
            fuzzy = (
                sum(scores) / len(scores) >= 0.86
                and min(scores) >= 0.72
            )
            if size == 1 and min(
                len(_match_key(previous[0])),
                len(_match_key(incoming[0])),
            ) < 6:
                fuzzy = False
            if exact or fuzzy:
                best_overlap = size
                break

        merged.extend(current[best_overlap:])
        removed_per_page.append(best_overlap)

    return merged, removed_per_page


def _is_ui_noise(text: str) -> bool:
    normalized = clean_ocr_text(text)
    if not normalized:
        return True
    if normalized in {"关注", "已关注", "分享", "收藏", "评论"}:
        return True
    if normalized.startswith(("说点什么", "展开全文", "收起全文")):
        return True
    if re.fullmatch(r"[\d.\s万wW]+", normalized):
        return True
    if re.fullmatch(r"(?:赞|点赞|收藏|评论|分享)\s*[\d.万wW]*", normalized):
        return True
    return False


def _heading_match(
    pattern: re.Pattern[str],
    text: str,
) -> re.Match[str] | None:
    return pattern.match(clean_ocr_text(text))


def _find_author(lines: list[str]) -> str | None:
    for line in lines[:8]:
        if _is_ui_noise(line):
            continue
        if _heading_match(INGREDIENT_HEADING, line) or _heading_match(
            STEP_HEADING, line
        ):
            continue
        if (
            2 <= len(line) <= 24
            and not re.search(r"[，。！？!?；;：:]", line)
            and (
                "@" in line
                or re.search(r"[A-Za-z0-9_]{2,}", line)
                or re.search(r"(?:厨房|小厨|好菜|美食|吃货)", line)
            )
        ):
            return line.lstrip("@")
    return None


def _first_content_index(lines: list[str]) -> int:
    for index, line in enumerate(lines):
        if _heading_match(INGREDIENT_HEADING, line) or _heading_match(
            STEP_HEADING, line
        ):
            return index
    return len(lines)


def _find_title(lines: list[str], author: str | None) -> str | None:
    stop = _first_content_index(lines)
    candidates = [
        line
        for line in lines[:stop]
        if not _is_ui_noise(line) and line != author
    ]
    if not candidates:
        return None

    first = candidates[0].lstrip("#").strip()
    if not 2 <= len(first) <= 22:
        return None
    if re.search(r"[，。！？!?；;：:]", first):
        return None
    if first.startswith(
        ("尤其", "不用", "今天", "这个", "真的", "在家", "简单", "最后")
    ):
        return None
    return first


def _parse_ingredient(segment: str) -> NoteIngredientCandidate | None:
    raw = clean_ocr_text(segment).strip("，,。.;；、 ")
    if not raw:
        return None

    prefix = PREFIX_AMOUNT.match(raw)
    if prefix:
        return NoteIngredientCandidate(
            raw_text=raw,
            name=prefix.group("name").strip() or None,
            amount_text=prefix.group("amount").strip() or None,
        )

    amount = AMOUNT_START.search(raw)
    if amount:
        name = raw[:amount.start()].strip(" -:：")
        amount_text = raw[amount.start():].strip()
        return NoteIngredientCandidate(
            raw_text=raw,
            name=name or None,
            amount_text=amount_text or None,
        )

    return NoteIngredientCandidate(raw_text=raw, name=raw)


def _split_ingredients(lines: list[str]) -> list[NoteIngredientCandidate]:
    candidates: list[NoteIngredientCandidate] = []
    for line in lines:
        for segment in re.split(r"[、，,；;]", line):
            parsed = _parse_ingredient(segment)
            if parsed is not None:
                # OCR keeps visual lines intact.  Notes often wrap a long
                # ingredient row so the name ends one line and its amount
                # starts the next one (for example "茄子" / "400g").  Treat
                # an amount-only fragment as a continuation of the previous
                # ingredient instead of exposing it as a second ingredient.
                if (
                    parsed.name is None
                    and parsed.amount_text
                    and candidates
                    and candidates[-1].amount_text is None
                ):
                    previous = candidates[-1]
                    candidates[-1] = NoteIngredientCandidate(
                        raw_text=f"{previous.raw_text} {parsed.raw_text}",
                        name=previous.name,
                        amount_text=parsed.amount_text,
                    )
                    continue
                candidates.append(parsed)
    return candidates


def _step_start(text: str) -> tuple[int, str] | None:
    cleaned = clean_ocr_text(text)
    numbered = NUMBERED_STEP.match(cleaned)
    if numbered:
        return int(numbered.group(1)), numbered.group(2).strip()

    circled = CIRCLED_STEP.match(cleaned)
    if circled:
        return CIRCLED_NUMBERS[circled.group(1)], circled.group(2).strip()
    return None


def _parse_steps(lines: list[str]) -> list[NoteStepCandidate]:
    steps: list[NoteStepCandidate] = []
    current_order: int | None = None
    current_parts: list[str] = []
    unnumbered: list[str] = []

    def flush() -> None:
        nonlocal current_order, current_parts
        if current_parts:
            steps.append(
                NoteStepCandidate(
                    order=current_order,
                    raw_text="".join(current_parts).strip(),
                )
            )
        current_order = None
        current_parts = []

    for line in lines:
        if _is_ui_noise(line) or STOP_HEADING.match(line):
            flush()
            break
        started = _step_start(line)
        if started is not None:
            flush()
            current_order, first_part = started
            if first_part:
                current_parts.append(first_part)
            continue
        if current_parts:
            current_parts.append(line)
        else:
            unnumbered.append(line)

    flush()
    if steps:
        return steps
    return [
        NoteStepCandidate(order=None, raw_text=line)
        for line in unnumbered
        if line
    ]


def parse_recipe_text(lines: Iterable[str]) -> ParsedRecipeText:
    cleaned = [
        normalized
        for line in lines
        if (normalized := clean_ocr_text(line))
    ]
    author = _find_author(cleaned)
    title = _find_title(cleaned, author)

    mode = "intro"
    intro_lines: list[str] = []
    ingredient_lines: list[str] = []
    step_lines: list[str] = []

    for line in cleaned:
        ingredient_heading = _heading_match(INGREDIENT_HEADING, line)
        if ingredient_heading:
            mode = "ingredients"
            trailing = clean_ocr_text(ingredient_heading.group(1))
            if trailing:
                ingredient_lines.append(trailing)
            continue

        step_heading = _heading_match(STEP_HEADING, line)
        if step_heading:
            mode = "steps"
            trailing = clean_ocr_text(step_heading.group(1))
            if trailing:
                step_lines.append(trailing)
            continue

        if STOP_HEADING.match(line):
            mode = "other"
            continue

        if mode == "ingredients":
            ingredient_lines.append(line)
        elif mode == "steps":
            step_lines.append(line)
        elif mode == "intro" and not _is_ui_noise(line):
            if line not in {author, title}:
                intro_lines.append(line)

    description = "\n".join(intro_lines).strip() or None
    return ParsedRecipeText(
        title=title,
        author=author,
        description=description,
        ingredients=_split_ingredients(ingredient_lines),
        steps=_parse_steps(step_lines),
    )
