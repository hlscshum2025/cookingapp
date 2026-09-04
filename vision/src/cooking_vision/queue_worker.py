from __future__ import annotations

import json
import os
import shutil
import socket
import tempfile
import time
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen


def _now() -> str:
    return datetime.now(UTC).isoformat()


class QueueRequestError(RuntimeError):
    pass


class SupabaseOcrQueue:
    """Minimal trusted Supabase client used only by the local admin worker."""

    def __init__(self, url: str, secret_key: str, worker_id: str | None = None) -> None:
        if not url or not secret_key:
            raise ValueError("SUPABASE_URL and SUPABASE_SECRET_KEY are required")
        self.url = url.rstrip("/")
        self.secret_key = secret_key
        self.worker_id = worker_id or f"{socket.gethostname()}-{uuid.uuid4().hex[:8]}"

    @classmethod
    def from_environment(cls) -> "SupabaseOcrQueue":
        secret = os.getenv("SUPABASE_SECRET_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        return cls(os.getenv("SUPABASE_URL", ""), secret or "", os.getenv("OCR_WORKER_ID"))

    def _request(
        self,
        path: str,
        *,
        method: str = "GET",
        body: Any | None = None,
        prefer: str | None = None,
        expect_json: bool = True,
    ) -> Any:
        data = None if body is None else json.dumps(body, ensure_ascii=False).encode("utf-8")
        headers = {
            "apikey": self.secret_key,
            "Authorization": f"Bearer {self.secret_key}",
            "Accept": "application/json",
        }
        if data is not None:
            headers["Content-Type"] = "application/json"
        if prefer:
            headers["Prefer"] = prefer
        request = Request(f"{self.url}{path}", data=data, headers=headers, method=method)
        try:
            with urlopen(request, timeout=60) as response:
                payload = response.read()
        except HTTPError as exc:
            details = exc.read().decode("utf-8", errors="replace")
            raise QueueRequestError(f"Supabase returned HTTP {exc.code}: {details}") from exc
        except URLError as exc:
            raise QueueRequestError(f"Supabase request failed: {exc.reason}") from exc
        if not expect_json:
            return payload
        if not payload:
            return None
        return json.loads(payload.decode("utf-8"))

    def claim_next(self) -> dict[str, Any] | None:
        rows = self._request(
            "/rest/v1/ocr_jobs?status=eq.queued&select=id,owner_id,kind,file_count,attempt_count"
            "&order=created_at.asc&limit=1"
        )
        if not rows:
            return None
        candidate = rows[0]
        job_id = quote(str(candidate["id"]), safe="")
        claimed = self._request(
            f"/rest/v1/ocr_jobs?id=eq.{job_id}&status=eq.queued",
            method="PATCH",
            body={
                "status": "processing",
                "worker_id": self.worker_id,
                "started_at": _now(),
                "attempt_count": int(candidate.get("attempt_count") or 0) + 1,
                "error_message": None,
            },
            prefer="return=representation",
        )
        return claimed[0] if claimed else None

    def requeue_stale(self, *, after_seconds: int = 3600) -> None:
        cutoff = quote((datetime.now(UTC) - timedelta(seconds=after_seconds)).isoformat(), safe="")
        self._request(
            f"/rest/v1/ocr_jobs?status=eq.processing&started_at=lt.{cutoff}",
            method="PATCH",
            body={
                "status": "queued",
                "worker_id": None,
                "started_at": None,
                "error_message": "Previous worker stopped; the job was queued again.",
            },
            prefer="return=minimal",
        )

    def files_for(self, job_id: str) -> list[dict[str, Any]]:
        encoded = quote(job_id, safe="")
        rows = self._request(
            f"/rest/v1/ocr_job_files?job_id=eq.{encoded}"
            "&select=input_index,bucket_id,storage_path,original_name,media_type,byte_size"
            "&order=input_index.asc"
        )
        return list(rows or [])

    def download(self, bucket: str, storage_path: str) -> bytes:
        bucket_part = quote(bucket, safe="")
        object_part = quote(storage_path, safe="/")
        return self._request(
            f"/storage/v1/object/authenticated/{bucket_part}/{object_part}",
            expect_json=False,
        )

    def complete(self, job_id: str, result: dict[str, Any]) -> None:
        self._patch_job(
            job_id,
            {
                "status": "review_required",
                "result": result,
                "error_message": None,
                "completed_at": _now(),
            },
        )

    def fail(self, job_id: str, error: str) -> None:
        self._patch_job(
            job_id,
            {
                "status": "failed",
                "error_message": error[:4000],
                "completed_at": _now(),
            },
        )

    def _patch_job(self, job_id: str, body: dict[str, Any]) -> None:
        encoded = quote(job_id, safe="")
        rows = self._request(
            f"/rest/v1/ocr_jobs?id=eq.{encoded}&status=eq.processing&worker_id=eq.{quote(self.worker_id,safe='')}",
            method="PATCH",
            body=body,
            prefer="return=representation",
        )
        if not rows:
            raise QueueRequestError("OCR job lease was lost before the result could be written")


def _process_job(queue: SupabaseOcrQueue, job: dict[str, Any]) -> None:
    job_id = str(job["id"])
    files = queue.files_for(job_id)
    if len(files) != int(job.get("file_count") or 0) or not files:
        raise ValueError("OCR job file metadata is incomplete")
    temp_dir = Path(tempfile.mkdtemp(prefix=f"cookingapp-ocr-{job_id[:8]}-"))
    paths: list[Path] = []
    display_names: list[str] = []
    try:
        for file in files:
            original_name = Path(str(file["original_name"])).name
            suffix = Path(original_name).suffix.lower()
            if suffix not in {".jpg", ".jpeg", ".png", ".webp"}:
                suffix = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}.get(
                    str(file.get("media_type")), ".jpg"
                )
            path = temp_dir / f"{int(file['input_index']):02d}{suffix}"
            path.write_bytes(queue.download(str(file["bucket_id"]), str(file["storage_path"])))
            paths.append(path)
            display_names.append(original_name)

        if job["kind"] == "receipt":
            from cooking_vision.receipt.multipage import build_receipt_batch_draft

            result = build_receipt_batch_draft(paths).to_dict()
        elif job["kind"] == "xiaohongshu":
            from cooking_vision.note.pipeline import build_xiaohongshu_recipe_draft

            result = build_xiaohongshu_recipe_draft(paths).to_dict()
        else:
            raise ValueError(f"Unsupported OCR job kind: {job['kind']}")

        result["source_images"] = display_names
        for index, page in enumerate(result.get("pages", [])):
            if index < len(display_names):
                page["source_image"] = display_names[index]
        queue.complete(job_id, result)
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


def run_queue_worker(*, once: bool = False, poll_seconds: float = 10.0) -> int:
    queue = SupabaseOcrQueue.from_environment()
    print(f"OCR queue worker ready: {queue.worker_id}", flush=True)
    queue.requeue_stale()
    while True:
        job = queue.claim_next()
        if job is None:
            if once:
                print("No queued OCR jobs.", flush=True)
                return 0
            time.sleep(max(1.0, poll_seconds))
            continue
        job_id = str(job["id"])
        print(f"Processing {job['kind']} job {job_id} ({job['file_count']} files)", flush=True)
        try:
            _process_job(queue, job)
            print(f"Finished OCR job {job_id}; waiting for user review.", flush=True)
        except Exception as exc:
            message = f"{type(exc).__name__}: {exc}"
            try:
                queue.fail(job_id, message)
            except Exception as report_error:
                message = f"{message}; failed to report status: {report_error}"
            print(f"OCR job {job_id} failed: {message}", flush=True)
        if once:
            return 0
