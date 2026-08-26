from __future__ import annotations

import argparse
import importlib.metadata
from pathlib import Path
from typing import Sequence

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
        for package in ["opencv-python","opencv-contrib-python","paddlepaddle","paddleocr","ultralytics","torch"]:
            print(f"{package}: {_package_version(package)}")
        return 0
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
    return 2


if __name__=="__main__":
    raise SystemExit(main())
