from cooking_vision.note.parser import parse_recipe_text


def test_amount_only_line_continues_previous_ingredient():
    parsed = parse_recipe_text([
        "食材准备",
        "茄子",
        "400g",
        "肉末",
        "120克",
        "做法步骤",
        "1 切好茄子",
    ])

    assert [(item.name, item.amount_text) for item in parsed.ingredients] == [
        ("茄子", "400g"),
        ("肉末", "120克"),
    ]


def test_amount_only_first_line_is_kept_for_manual_review():
    parsed = parse_recipe_text(["食材", "适量", "步骤", "1 拌匀"])

    assert len(parsed.ingredients) == 1
    assert parsed.ingredients[0].name is None
    assert parsed.ingredients[0].amount_text == "适量"
