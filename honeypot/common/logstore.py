"""Thread-safe append to the JSON-array log files the existing log_converter.py reads."""
import json
import os
import threading
from pathlib import Path
from typing import Dict

LOG_DIR = Path(__file__).resolve().parents[1] / "logs"
_lock = threading.Lock()


def append_json_log(path: Path, record: Dict) -> None:
    """Read-modify-write under a lock, with an atomic replace so a crash cannot truncate the log."""
    path = Path(path)
    with _lock:
        path.parent.mkdir(parents=True, exist_ok=True)
        records = []
        if path.exists():
            try:
                with open(path, "r", encoding="utf-8") as fh:
                    records = json.load(fh)
            except (ValueError, OSError):
                records = []
        records.append(record)
        tmp = path.with_suffix(path.suffix + ".tmp")
        with open(tmp, "w", encoding="utf-8") as fh:
            json.dump(records, fh, indent=4)
        os.replace(tmp, path)
