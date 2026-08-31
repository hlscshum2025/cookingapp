from cooking_vision.contracts import BoundingBox
from cooking_vision.note.contracts import (
    NoteIngredientCandidate,
    NoteOcrPage,
    NoteStepCandidate,
    RecipeScreenshotDraft,
)


def test_recipe_screenshot_draft_is_review_only_and_json_ready():
    draft = RecipeScreenshotDraft(
        source_images=["page-1.png", "page-2.png"],
        provider="test",
        model_version="0",
        pages=[
            NoteOcrPage(
                source_image="page-1.png",
                input_index=1,
                crop_mode="right",
                crop_bbox=BoundingBox(600, 0, 1000, 800),
                image_width=1000,
                image_height=800,
            )
        ],
        ingredients=[
            NoteIngredientCandidate(
                raw_text="茄子2根",
                name="茄子",
                amount_text="2根",
            )
        ],
        steps=[NoteStepCandidate(raw_text="茄子切条。", order=1)],
    )

    payload = draft.to_dict()

    assert payload["confirmed"] is False
    assert payload["ingredients"][0]["verification_status"] == "unverified"
    assert payload["steps"][0]["verification_status"] == "unverified"
    assert payload["pages"][0]["crop_bbox"]["x_min"] == 600
