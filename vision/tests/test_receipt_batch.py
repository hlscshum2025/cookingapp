from __future__ import annotations

from cooking_vision.cli import main
from cooking_vision.receipt.batch import find_receipt_images


def test_find_receipt_images_filters_and_sorts(tmp_path):
    (tmp_path / "b.PNG").write_bytes(b"image")
    (tmp_path / "a.jpg").write_bytes(b"image")
    (tmp_path / "notes.txt").write_text("not an image", encoding="utf-8")

    found = find_receipt_images(tmp_path)

    assert [path.name for path in found] == ["a.jpg", "b.PNG"]


def test_empty_batch_reports_paths_and_writes_logs(tmp_path, capsys):
    input_dir = tmp_path / "receipts"
    output_dir = tmp_path / "output"
    input_dir.mkdir()

    exit_code = main(
        ["receipt-batch", str(input_dir), "--output", str(output_dir)]
    )

    terminal = capsys.readouterr().out
    assert exit_code == 2
    assert "找到支持的图片：0 张" in terminal
    assert "批处理未开始" in terminal
    assert str(output_dir / "summary.csv") in terminal
    assert (output_dir / "summary.csv").is_file()
    assert (output_dir / "logs" / "batch.log").is_file()
    assert "FileNotFoundError" in (output_dir / "logs" / "errors.log").read_text(
        encoding="utf-8"
    )
