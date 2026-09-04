from __future__ import annotations

import argparse
import importlib.metadata
import sys
from pathlib import Path
from typing import Sequence

from cooking_vision.diagnostics import probe_import
from cooking_vision.json_io import write_json


def build_parser()->argparse.ArgumentParser:
    parser=argparse.ArgumentParser(prog="cooking-vision",description="CookingApp local OCR and food-recognition baselines")
    commands=parser.add_subparsers(dest="command",required=True)

    preprocess=commands.add_parser("preprocess",help="Run OpenCV receipt preprocessing only")
    preprocess.add_argument("image",type=Path)
    preprocess.add_argument("--output",type=Path,default=Path("outputs/receipt-preprocess"))
    preprocess.add_argument("--max-side",type=int,default=2200)

    receipt=commands.add_parser("receipt",help="Build a reviewable receipt OCR JSON draft")
    receipt.add_argument("image",type=Path)
    receipt.add_argument("--output",type=Path,default=Path("outputs/receipt.json"))
    receipt.add_argument("--stages",type=Path,default=Path("outputs/receipt-preprocess"))
    receipt.add_argument("--language",default="german")
    receipt.add_argument("--device",default="cpu")
    receipt.add_argument("--min-confidence",type=float,default=.35)
    receipt.add_argument("--max-side",type=int,default=2200)

    receipt_batch=commands.add_parser("receipt-batch",help="Run receipt OCR for a local image directory")
    receipt_batch.add_argument("input",type=Path)
    receipt_batch.add_argument("--output",type=Path,default=Path("outputs/receipt-batch"))
    receipt_batch.add_argument("--language",default="german")
    receipt_batch.add_argument("--device",default="cpu")
    receipt_batch.add_argument("--min-confidence",type=float,default=.35)
    receipt_batch.add_argument("--max-side",type=int,default=2200)
    receipt_batch.add_argument("--save-stages",action="store_true")
    receipt_batch.add_argument("--no-recursive",action="store_true")

    note=commands.add_parser("xiaohongshu",help="Build one recipe draft from ordered Xiaohongshu screenshots")
    note.add_argument("images",type=Path,nargs="+")
    note.add_argument("--output",type=Path,default=Path("outputs/xiaohongshu-recipe.json"))
    note.add_argument("--stages",type=Path)
    note.add_argument("--language",default="ch")
    note.add_argument("--device",default="cpu")
    note.add_argument("--min-confidence",type=float,default=.35)
    note.add_argument("--max-side",type=int,default=2200)
    note.add_argument("--crop-mode",choices=["auto","full","right"],default="auto")
    note.add_argument("--right-ratio",type=float,default=.42)

    detect=commands.add_parser("detect",help="Detect food candidates with YOLO-World")
    detect.add_argument("image",type=Path)
    detect.add_argument("--scene",choices=["fridge","tabletop","bagged","unknown"],default="unknown")
    detect.add_argument("--output",type=Path,default=Path("outputs/vision.json"))
    detect.add_argument("--annotated",type=Path,default=Path("outputs/vision-annotated.jpg"))
    detect.add_argument("--model",default="yolov8s-worldv2.pt")
    detect.add_argument("--classes",nargs="+")
    detect.add_argument("--confidence",type=float,default=.20)
    detect.add_argument("--image-size",type=int,default=640)
    detect.add_argument("--device",default="cpu")

    queue_worker=commands.add_parser("queue-worker",help="Process persistent Supabase OCR jobs on this computer")
    queue_worker.add_argument("--once",action="store_true",help="Process at most one queued job and exit")
    queue_worker.add_argument("--poll-seconds",type=float,default=10.0,help="Seconds between empty-queue checks")

    commands.add_parser("environment",help="Show installed baseline package versions")
    return parser


def _package_version(name:str)->str:
    try:
        return importlib.metadata.version(name)
    except importlib.metadata.PackageNotFoundError:
        return "not installed"


def main(argv:Sequence[str]|None=None)->int:
    args=build_parser().parse_args(argv)
    if args.command=="environment":
        print(f"python executable: {sys.executable}")
        print(f"python version: {sys.version.split()[0]}")
        print(f"cookingapp-vision: {_package_version('cookingapp-vision')}")
        print(f"cooking_vision code: {Path(__file__).resolve()}")
        print("installed distributions:")
        for package in ["opencv-python","opencv-contrib-python","paddlepaddle","paddleocr","ultralytics","torch"]:
            print(f"{package}: {_package_version(package)}")
        print("runtime import checks:")
        failed=False
        for module in ["cv2","paddle","paddleocr"]:
            probe=probe_import(module)
            if probe.ok:
                print(f"{module}: OK ({probe.version})")
                continue
            failed=True
            print(f"{module}: FAILED (exit_code={probe.return_code})")
            print(probe.details)
        if _package_version("ultralytics")=="not installed" and _package_version("torch")=="not installed":
            print("note: ultralytics and torch are intentionally absent from the OCR-only environment.")
        return 1 if failed else 0
    if args.command=="preprocess":
        from cooking_vision.receipt.preprocess import preprocess_receipt,save_preprocess_stages
        result=preprocess_receipt(args.image,max_side=args.max_side)
        saved=save_preprocess_stages(result,args.output)
        print(f"document_found={result.document_found}")
        print("\n".join(str(path) for path in saved))
        return 0
    if args.command=="receipt":
        from cooking_vision.receipt.pipeline import build_receipt_draft
        draft=build_receipt_draft(
            args.image,
            language=args.language,
            device=args.device,
            min_confidence=args.min_confidence,
            max_side=args.max_side,
            stages_dir=args.stages,
        )
        path=write_json(draft.to_dict(),args.output)
        print(f"OCR lines: {len(draft.lines)}, item candidates: {len(draft.items)}")
        print(path)
        return 0
    if args.command=="receipt-batch":
        from cooking_vision.receipt.batch import run_receipt_batch
        result=run_receipt_batch(
            args.input,
            args.output,
            language=args.language,
            device=args.device,
            min_confidence=args.min_confidence,
            max_side=args.max_side,
            save_stages=args.save_stages,
            recursive=not args.no_recursive,
        )
        if result.fatal_error is not None:
            return 2
        return 1 if result.failed else 0
    if args.command=="xiaohongshu":
        from cooking_vision.note.pipeline import build_xiaohongshu_recipe_draft
        draft=build_xiaohongshu_recipe_draft(
            args.images,
            language=args.language,
            device=args.device,
            min_confidence=args.min_confidence,
            max_side=args.max_side,
            crop_mode=args.crop_mode,
            right_ratio=args.right_ratio,
            stages_dir=args.stages,
        )
        path=write_json(draft.to_dict(),args.output)
        print(
            f"Screenshots: {len(draft.pages)}, "
            f"ingredients: {len(draft.ingredients)}, steps: {len(draft.steps)}"
        )
        print(path)
        return 0
    if args.command=="detect":
        from cooking_vision.detection.yolo_world import detect_food_candidates
        candidates=detect_food_candidates(
            args.image,
            scene=args.scene,
            model_name=args.model,
            classes=args.classes,
            confidence=args.confidence,
            image_size=args.image_size,
            device=args.device,
            annotated_path=args.annotated,
        )
        path=write_json([candidate.to_dict() for candidate in candidates],args.output)
        print(f"Vision candidates: {len(candidates)}")
        print(path)
        return 0
    if args.command=="queue-worker":
        from cooking_vision.queue_worker import run_queue_worker
        return run_queue_worker(once=args.once,poll_seconds=args.poll_seconds)
    return 2


if __name__=="__main__":
    raise SystemExit(main())
