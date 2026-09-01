from __future__ import annotations

import json
import os
import shutil
import tempfile
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Literal
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from cooking_vision.note.pipeline import build_xiaohongshu_recipe_draft
from cooking_vision.receipt.multipage import build_receipt_batch_draft

JobKind = Literal["receipt", "xiaohongshu"]
JobStatus = Literal["queued", "running", "review_required", "failed"]


def _now() -> str:
    return datetime.now(UTC).isoformat()


@dataclass
class OcrJob:
    id: str
    kind: JobKind
    owner_id: str
    status: JobStatus = "queued"
    created_at: str = field(default_factory=_now)
    updated_at: str = field(default_factory=_now)
    result: dict[str, Any] | None = None
    error: str | None = None

    def public_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "kind": self.kind,
            "status": self.status,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "result": self.result,
            "error": self.error,
        }


class InMemoryJobStore:
    """V1 store. Replace with Supabase-backed jobs before horizontal scaling."""

    def __init__(self) -> None:
        self._jobs: dict[str, OcrJob] = {}
        self._lock = threading.Lock()

    def create(self, kind: JobKind, owner_id: str) -> OcrJob:
        job = OcrJob(id=str(uuid.uuid4()), kind=kind, owner_id=owner_id)
        with self._lock:
            self._jobs[job.id] = job
        return job

    def get(self, job_id: str) -> OcrJob | None:
        with self._lock:
            return self._jobs.get(job_id)

    def update(self, job_id: str, **changes: Any) -> None:
        with self._lock:
            job = self._jobs[job_id]
            for key, value in changes.items():
                setattr(job, key, value)
            job.updated_at = _now()


def validate_access_token(token: str) -> str:
    if os.getenv("VISION_DEV_ALLOW_UNAUTHENTICATED") == "1":
        return "development-user"
    supabase_url = os.getenv("SUPABASE_URL", "").rstrip("/")
    publishable_key = os.getenv("SUPABASE_PUBLISHABLE_KEY", "")
    if not token or not supabase_url or not publishable_key:
        raise PermissionError("OCR worker authentication is not configured")
    request = Request(
        f"{supabase_url}/auth/v1/user",
        headers={"Authorization": f"Bearer {token}", "apikey": publishable_key},
    )
    try:
        with urlopen(request, timeout=10) as response:
            if response.status != 200:
                raise PermissionError("Invalid access token")
            body = json.loads(response.read().decode("utf-8"))
            user_id = body.get("id")
            if not isinstance(user_id, str) or not user_id:
                raise PermissionError("Invalid access token")
            return user_id
    except (HTTPError, URLError) as exc:
        raise PermissionError("Invalid or unverifiable access token") from exc


def create_app():
    app = FastAPI(title="CookingApp OCR Worker", version="0.1.0")
    origins = [value.strip() for value in os.getenv("VISION_ALLOWED_ORIGINS", "http://localhost:3000").split(",") if value.strip()]
    app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=False, allow_methods=["GET", "POST"], allow_headers=["Authorization", "Content-Type"])
    store = InMemoryJobStore()
    executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="ocr-worker")

    def process(job_id: str, kind: JobKind, paths: list[Path], display_names: list[str], temp_dir: Path) -> None:
        store.update(job_id, status="running")
        try:
            if kind == "receipt":
                result = build_receipt_batch_draft(paths).to_dict()
            else:
                result = build_xiaohongshu_recipe_draft(paths).to_dict()
            result["source_images"] = display_names
            for index, page in enumerate(result.get("pages", [])):
                if index < len(display_names):
                    page["source_image"] = display_names[index]
            store.update(job_id, status="review_required", result=result)
        except Exception as exc:  # surfaced to the review UI, worker remains alive
            store.update(job_id, status="failed", error=f"{type(exc).__name__}: {exc}")
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)

    def bearer(value: str | None) -> str:
        if not value or not value.startswith("Bearer "):
            return ""
        return value[7:].strip()

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok", "model_cache": "process-scoped"}

    @app.post("/v1/ocr/jobs", status_code=202)
    async def create_job(
        kind: JobKind,
        files: list[UploadFile] = File(...),
        authorization: str | None = Header(default=None),
    ) -> dict[str, Any]:
        try:
            owner_id = validate_access_token(bearer(authorization))
        except PermissionError as exc:
            raise HTTPException(status_code=401, detail=str(exc)) from exc
        if not files or len(files) > 12:
            raise HTTPException(status_code=400, detail="Upload between 1 and 12 images")
        temp_dir = Path(tempfile.mkdtemp(prefix="cookingapp-ocr-"))
        paths: list[Path] = []
        display_names: list[str] = []
        try:
            for index, upload in enumerate(files, start=1):
                suffix = Path(upload.filename or "image.jpg").suffix.lower() or ".jpg"
                if suffix not in {".jpg", ".jpeg", ".png", ".webp"}:
                    raise HTTPException(status_code=415, detail="Only JPEG, PNG and WebP are supported")
                path = temp_dir / f"{index:02d}{suffix}"
                size = 0
                with path.open("wb") as target:
                    while chunk := await upload.read(1024 * 1024):
                        size += len(chunk)
                        if size > 15 * 1024 * 1024:
                            raise HTTPException(status_code=413, detail="Each image must be at most 15 MB")
                        target.write(chunk)
                paths.append(path)
                display_names.append(Path(upload.filename or f"image-{index}{suffix}").name)
        except Exception:
            shutil.rmtree(temp_dir, ignore_errors=True)
            raise
        job = store.create(kind, owner_id)
        executor.submit(process, job.id, kind, paths, display_names, temp_dir)
        return job.public_dict()

    @app.get("/v1/ocr/jobs/{job_id}")
    def get_job(job_id: str, authorization: str | None = Header(default=None)) -> dict[str, Any]:
        try:
            owner_id = validate_access_token(bearer(authorization))
        except PermissionError as exc:
            raise HTTPException(status_code=401, detail=str(exc)) from exc
        job = store.get(job_id)
        if job is None:
            raise HTTPException(status_code=404, detail="OCR job not found")
        if job.owner_id != owner_id:
            raise HTTPException(status_code=404, detail="OCR job not found")
        return job.public_dict()

    return app


app = create_app()
