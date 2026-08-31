from cooking_vision.note.parser import merge_page_lines, parse_recipe_text


def sample_screenshot_lines() -> list[str]:
    return [
        "搞一碗好菜778",
        "尤其是最后那个浓浓的汤汁，拌米饭真的绝！！",
        "不用复杂调料，也不用饭店做法，在家就能做出那种香喷喷的肉末茄子",
        "🛒 食材准备",
        "茄子2根约400g、肉末120g、蒜适量、豆瓣酱1勺、生抽1勺、老抽半勺、白糖1小勺、淀粉水小半碗。",
        "👩‍🍳 做法步骤",
        "1 茄子洗净切成长条，蒜切成蒜末备用，茄子切好后可以先放一会儿，避免出水太多。",
        "2 锅里倒适量油，放入茄子煎炒到变软，表面微微变色后盛出备用。",
        "3 锅里留少许底油，放入肉末炒散，炒到肉末变色、香味出来。",
        "4 加入蒜末和豆瓣酱1勺，小火炒出香味和红油。",
        "5 倒入茄子翻炒均匀，再加入生抽1勺、老抽半勺、白糖1小勺调味上色。",
        "6 最后倒入小半碗淀粉水，翻炒到汤汁浓稠挂在茄子上，就可以出锅啦。",
        "说点什么...",
        "1.5万 1.3万 103",
    ]


def test_parses_sample_xiaohongshu_recipe_without_inventing_title():
    parsed = parse_recipe_text(sample_screenshot_lines())

    assert parsed.author == "搞一碗好菜778"
    assert parsed.title is None
    assert "浓浓的汤汁" in (parsed.description or "")
    assert len(parsed.ingredients) == 8
    assert parsed.ingredients[0].name == "茄子"
    assert parsed.ingredients[0].amount_text == "2根约400g"
    assert parsed.ingredients[-1].name == "淀粉水"
    assert parsed.ingredients[-1].amount_text == "小半碗"
    assert [step.order for step in parsed.steps] == [1, 2, 3, 4, 5, 6]
    assert all(step.verification_status == "unverified" for step in parsed.steps)


def test_extracts_short_explicit_title_after_author():
    parsed = parse_recipe_text(
        [
            "一日三餐123",
            "肉末茄子",
            "食材准备",
            "茄子2根、肉末120g",
            "做法步骤",
            "1 茄子切条。",
        ]
    )

    assert parsed.author == "一日三餐123"
    assert parsed.title == "肉末茄子"


def test_merges_multi_screenshot_overlap_at_page_boundaries():
    merged, removed = merge_page_lines(
        [
            ["做法步骤", "1 茄子切条。", "2 锅中放油。", "3 放入肉末。"],
            ["2 锅中放油。", "3 放入肉末。", "4 加入调料。", "5 收汁。"],
        ]
    )

    assert removed == [0, 2]
    assert merged == [
        "做法步骤",
        "1 茄子切条。",
        "2 锅中放油。",
        "3 放入肉末。",
        "4 加入调料。",
        "5 收汁。",
    ]


def test_ingredient_without_amount_stays_unknown():
    parsed = parse_recipe_text(
        [
            "食材",
            "葱、姜少许",
            "步骤",
            "1 切好备用。",
        ]
    )

    assert parsed.ingredients[0].name == "葱"
    assert parsed.ingredients[0].amount_text is None
    assert parsed.ingredients[1].name == "姜"
    assert parsed.ingredients[1].amount_text == "少许"
