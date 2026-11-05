"""
Sensor client: ships honeypot events to the SentinelAI backend (POST /api/events/ingest).

- Authenticates with the X-API-Key header (SENTINEL_SENSOR_API_KEY).
- Non-blocking: send() only enqueues; a background thread does the HTTP work, so a slow or
  unreachable backend never slows the honeypot down.
- Never loses events silently: failures are appended to a local spool file and replayed later.
- Standard library only, so the honeypot's dependency list stays at "flask".
"""
import json
import logging
import os
import queue
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Dict, List, Optional

logger = logging.getLogger("SentinelAI.Sensor")

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SPOOL = REPO_ROOT / "honeypot" / "logs" / "sensor_spool.jsonl"
INGEST_PATH = "/api/events/ingest"

# The honeypot is the most exposed process in the project, so it must never inherit backend
# secrets (JWT key, DB URL, SMTP password). Only these .env keys are read.
_ALLOWED_ENV_PREFIXES = ("SENTINEL_SENSOR_", "SENTINELAI_BACKEND_URL", "HONEYPOT_")


def load_env_file(path: Optional[Path] = None) -> None:
    """Tiny .env reader limited to sensor settings. Never overrides real environment variables."""
    path = Path(path) if path else REPO_ROOT / ".env"
    if not path.is_file():
        return
    for raw in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        if not key.startswith(_ALLOWED_ENV_PREFIXES) or key in os.environ:
            continue
        value = value.strip()
        if value[:1] in ("'", '"') and value[-1:] == value[:1] and len(value) >= 2:
            value = value[1:-1]
        else:
            value = value.split(" #")[0].strip()
        os.environ[key] = value


class SensorClient:
    def __init__(
        self,
        backend_url: Optional[str] = None,
        api_key: Optional[str] = None,
        spool_path: Optional[Path] = None,
        timeout: float = 10.0,
        attempts: int = 3,
        backoff: float = 0.5,
        max_queue: int = 1000,
        max_spool: int = 5000,
        replay_interval: float = 30.0,
        autostart: bool = True,
    ):
        self.backend_url = (backend_url or "http://127.0.0.1:8000").rstrip("/")
        self.api_key = (api_key or "").strip()
        self.spool_path = Path(spool_path) if spool_path else DEFAULT_SPOOL
        self.timeout = timeout
        self.attempts = max(1, attempts)
        self.backoff = backoff
        self.max_spool = max_spool
        self.replay_interval = replay_interval

        self._queue: "queue.Queue[Dict]" = queue.Queue(maxsize=max_queue)
        self._spool_lock = threading.Lock()
        self._stop = threading.Event()
        self._warned_disabled = False
        self._thread: Optional[threading.Thread] = None
        self.stats = {"sent": 0, "spooled": 0, "dropped": 0}

        if self.enabled and autostart:
            self._thread = threading.Thread(target=self._run, name="sentinel-sensor", daemon=True)
            self._thread.start()

    # ---- public API ----
    @property
    def enabled(self) -> bool:
        return bool(self.api_key)

    @property
    def ingest_url(self) -> str:
        return f"{self.backend_url}{INGEST_PATH}"

    def send(self, payload: Dict) -> bool:
        """Queue an event. Returns False if the sensor is disabled or the event had to be spooled."""
        if not self.enabled:
            if not self._warned_disabled:
                logger.warning(
                    "SENTINEL_SENSOR_API_KEY is not set: events are logged locally only and "
                    "NOT sent to the backend."
                )
                self._warned_disabled = True
            return False
        try:
            self._queue.put_nowait(payload)
            return True
        except queue.Full:
            self._spool([payload])
            return False

    def flush(self, timeout: float = 10.0) -> bool:
        """Block until the queue is drained (scripts and tests). True if fully drained."""
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            if self._queue.unfinished_tasks == 0:
                return True
            time.sleep(0.02)
        return self._queue.unfinished_tasks == 0

    def close(self) -> None:
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=2.0)
        leftovers: List[Dict] = []
        while True:
            try:
                leftovers.append(self._queue.get_nowait())
                self._queue.task_done()
            except queue.Empty:
                break
        if leftovers:
            self._spool(leftovers)

    def replay_spool(self) -> int:
        """Re-send spooled events. Stops at the first failure. Returns the number delivered."""
        with self._spool_lock:
            if not self.spool_path.is_file():
                return 0
            lines = [l for l in self.spool_path.read_text(encoding="utf-8").splitlines() if l.strip()]
            self.spool_path.unlink()

        sent = 0
        remaining: List[str] = []
        for index, line in enumerate(lines):
            try:
                payload = json.loads(line)
            except ValueError:
                continue  # unreadable line: discard
            result = self._post(payload)
            if result == "ok":
                sent += 1
                self.stats["sent"] += 1
            elif result == "drop":
                self.stats["dropped"] += 1
            else:
                remaining = lines[index:]
                break

        if remaining:
            with self._spool_lock:
                with open(self.spool_path, "a", encoding="utf-8") as fh:
                    fh.write("\n".join(remaining) + "\n")
        return sent

    def spool_size(self) -> int:
        with self._spool_lock:
            if not self.spool_path.is_file():
                return 0
            return sum(1 for l in self.spool_path.read_text(encoding="utf-8").splitlines() if l.strip())

    # ---- worker ----
    def _run(self) -> None:
        last_replay = time.monotonic()
        while not self._stop.is_set():
            try:
                payload = self._queue.get(timeout=0.5)
            except queue.Empty:
                if (time.monotonic() - last_replay) >= self.replay_interval and self.spool_size():
                    self.replay_spool()
                    last_replay = time.monotonic()
                continue
            try:
                self._deliver(payload)
            finally:
                self._queue.task_done()

    def _deliver(self, payload: Dict) -> bool:
        for attempt in range(self.attempts):
            result = self._post(payload)
            if result == "ok":
                self.stats["sent"] += 1
                return True
            if result == "drop":
                self.stats["dropped"] += 1
                return False
            if result == "auth":
                break  # a wrong key will not fix itself by retrying
            if attempt < self.attempts - 1:
                time.sleep(self.backoff * (2 ** attempt))
        self._spool([payload])
        return False

    def _post(self, payload: Dict) -> str:
        """Returns 'ok', 'retry' (transient), 'auth' (key rejected) or 'drop' (permanently bad)."""
        request = urllib.request.Request(
            self.ingest_url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json", "X-API-Key": self.api_key},
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                return "ok" if 200 <= response.status < 300 else "retry"
        except urllib.error.HTTPError as err:
            if err.code in (401, 403):
                logger.error("Backend rejected the sensor API key (HTTP %s). Check SENTINEL_SENSOR_API_KEY.", err.code)
                return "auth"
            if err.code in (408, 429) or err.code >= 500:
                return "retry"
            logger.warning("Backend refused event permanently (HTTP %s); dropping it.", err.code)
            return "drop"
        except (urllib.error.URLError, OSError, TimeoutError):
            return "retry"

    def _spool(self, payloads: List[Dict]) -> None:
        with self._spool_lock:
            self.spool_path.parent.mkdir(parents=True, exist_ok=True)
            with open(self.spool_path, "a", encoding="utf-8") as fh:
                for p in payloads:
                    fh.write(json.dumps(p) + "\n")
            self.stats["spooled"] += len(payloads)
            # Bound disk use: keep only the newest max_spool events.
            if self.spool_path.stat().st_size > self.max_spool * 2048:
                lines = self.spool_path.read_text(encoding="utf-8").splitlines()
                self.spool_path.write_text("\n".join(lines[-self.max_spool:]) + "\n", encoding="utf-8")


def build_client_from_env() -> SensorClient:
    """Loads sensor settings from .env / the environment and returns a ready client."""
    load_env_file()
    return SensorClient(
        backend_url=os.getenv("SENTINELAI_BACKEND_URL", "http://127.0.0.1:8000"),
        api_key=os.getenv("SENTINEL_SENSOR_API_KEY", ""),
    )
