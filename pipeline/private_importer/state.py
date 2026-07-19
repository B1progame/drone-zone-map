"""Atomic, resumable scan state stored below the ignored private-data root."""
from __future__ import annotations

from datetime import datetime, timezone
import json
from pathlib import Path
from typing import Any


def load_state(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {"status": "new", "completedCells": [], "requestCount": 0, "featureCount": 0, "errors": []}
    return json.loads(path.read_text(encoding="utf-8"))


def save_state(path: Path, state: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    state = {**state, "updatedAt": datetime.now(timezone.utc).isoformat()}
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(state, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    temporary.replace(path)
