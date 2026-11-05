"""
One-off cleanup for cloud/audit_logs.jsonl. Run from the project root:

    python scripts/normalize_audit_log.py            # dry run: only reports
    python scripts/normalize_audit_log.py --apply    # writes a timestamped backup, then rewrites

What it fixes:
  1. Legacy-format records (from the old simulate-event exporter). If a standard SOAR record already
     exists for the same event_id, the legacy record is a duplicate and is dropped; otherwise it is
     converted to the standard shape.
  2. Repeated log_id values (the old counter restarted on every process start). Repeats get a new
     unique log_id; the original is kept in metadata.original_log_id.
"""
import argparse
import json
import shutil
import sys
import uuid
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_PATH = ROOT / "cloud" / "audit_logs.jsonl"
STANDARD_KEYS = {"log_id", "timestamp", "event_id", "source_ip", "risk_score", "action",
                 "policy_applied", "dry_run", "summary", "metadata"}


def new_log_id() -> str:
    return f"SOAR-LOG-{uuid.uuid4().hex[:12].upper()}"


def is_standard(rec: dict) -> bool:
    return "action" in rec and "log_id" in rec


def convert_legacy(rec: dict) -> dict:
    action = str(rec.get("response_action") or rec.get("action") or "MONITOR")
    return {
        "log_id": new_log_id(),
        "timestamp": rec.get("timestamp", ""),
        "event_id": rec.get("event_id", ""),
        "source_ip": rec.get("source_ip", ""),
        "risk_score": float(rec.get("risk_score", 0.0)),
        "action": action,
        "policy_applied": rec.get("soar_policy") or rec.get("policy_applied") or "unknown",
        "dry_run": True,
        "summary": f"[migrated] legacy record for {rec.get('source_ip', 'unknown')}",
        "metadata": {"migrated_from": "legacy_exporter",
                     **{k: v for k, v in rec.items() if k not in STANDARD_KEYS}},
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--path", default=str(DEFAULT_PATH))
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()
    path = Path(args.path)

    if not path.exists():
        print(f"Nothing to do: {path} does not exist.")
        return 0

    records, bad_lines = [], 0
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        try:
            records.append(json.loads(line))
        except ValueError:
            bad_lines += 1

    standard_event_ids = {r["event_id"] for r in records if is_standard(r)}
    out, seen_ids = [], set()
    dropped = converted = reassigned = 0

    for rec in records:
        if not is_standard(rec):
            if rec.get("event_id") in standard_event_ids:
                dropped += 1
                continue
            rec = convert_legacy(rec)
            converted += 1
        if rec["log_id"] in seen_ids:
            rec.setdefault("metadata", {})
            if not isinstance(rec["metadata"], dict):
                rec["metadata"] = {}
            rec["metadata"]["original_log_id"] = rec["log_id"]
            rec["log_id"] = new_log_id()
            reassigned += 1
        seen_ids.add(rec["log_id"])
        out.append(rec)

    print(f"Read {len(records)} records ({bad_lines} unreadable lines skipped)")
    print(f"  duplicate legacy records dropped : {dropped}")
    print(f"  legacy records converted         : {converted}")
    print(f"  repeated log_ids reassigned      : {reassigned}")
    print(f"Result: {len(out)} records, {len({r['log_id'] for r in out})} unique log_ids")

    if not args.apply:
        print("\nDry run only. Re-run with --apply to write changes.")
        return 0

    backup = path.with_name(f"{path.name}.bak-{datetime.now().strftime('%Y%m%d-%H%M%S')}")
    shutil.copy2(path, backup)
    path.write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in out), encoding="utf-8")
    print(f"\nBackup: {backup}\nRewritten: {path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
