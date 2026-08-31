from __future__ import annotations

import subprocess
import sys
from dataclasses import dataclass


@dataclass(frozen=True)
class ImportProbe:
    module: str
    ok: bool
    version: str = ""
    return_code: int | None = None
    details: str = ""


def probe_import(module: str, timeout_seconds: int = 90) -> ImportProbe:
    """Import one native dependency in a child process so DLL crashes are observable."""
    script = (
        "import importlib, sys; "
        "loaded = importlib.import_module(sys.argv[1]); "
        "print(getattr(loaded, '__version__', 'unknown'), flush=True)"
    )
    try:
        completed = subprocess.run(
            [sys.executable, "-X", "faulthandler", "-c", script, module],
            capture_output=True,
            text=True,
            errors="replace",
            timeout=timeout_seconds,
            check=False,
        )
    except subprocess.TimeoutExpired as error:
        return ImportProbe(
            module=module,
            ok=False,
            details=f"import timed out after {timeout_seconds} seconds: {error}",
        )

    stdout = completed.stdout.strip()
    stderr = completed.stderr.strip()
    if completed.returncode == 0:
        version = stdout.splitlines()[-1] if stdout else "unknown"
        return ImportProbe(
            module=module,
            ok=True,
            version=version,
            return_code=completed.returncode,
            details=stderr,
        )

    details = stderr or stdout or "process ended without Python output"
    return ImportProbe(
        module=module,
        ok=False,
        return_code=completed.returncode,
        details=details[-4000:],
    )
