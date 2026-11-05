"""
SentinelAI Cloud Storage Exporter Module (Member 4 Cloud Integration)
Simulates cloud object-storage archiving (e.g. AWS S3 / GCP GCS style) for SOAR audit records.
Partitioned by date: cloud/object_storage/audit-logs/YYYY/MM/DD/audit_YYYYMMDD_HHMMSS.jsonl
"""

import json
import logging
import os
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

logger = logging.getLogger("SentinelAI.CloudStorageExporter")


class CloudStorageExporter:
    """
    Local-first simulated Cloud Object Storage Exporter for SentinelAI Audit Logs.
    Archives JSONL audit trail records into date-partitioned simulated storage directories.
    """

    def __init__(
        self,
        source_log_path: Optional[str] = None,
        storage_dir: Optional[str] = None,
    ):
        self.source_log_path = source_log_path or os.path.join("cloud", "audit_logs.jsonl")
        self.storage_dir = storage_dir or os.path.join("cloud", "object_storage")

    def read_source_records(self) -> List[Dict[str, Any]]:
        """
        Reads and parses valid JSON objects from the source JSONL audit log without altering it.
        Returns empty list if file is missing or empty.
        """
        if not os.path.exists(self.source_log_path):
            logger.warning(f"Source audit log file not found at: {self.source_log_path}")
            return []

        records = []
        try:
            with open(self.source_log_path, "r", encoding="utf-8") as f:
                for line_num, line in enumerate(f, 1):
                    line_str = line.strip()
                    if not line_str:
                        continue
                    try:
                        obj = json.loads(line_str)
                        records.append(obj)
                    except json.JSONDecodeError as err:
                        logger.warning(f"Skipping invalid JSON on line {line_num} in {self.source_log_path}: {err}")
        except Exception as err:
            logger.error(f"Error reading source audit log {self.source_log_path}: {err}")

        return records

    def export_audit_logs(
        self,
        partition_by_date: bool = True,
        custom_prefix: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Archives records from source_log_path to simulated object storage directory.
        
        Returns:
            Dict containing:
            - status: "SUCCESS" | "MISSING_SOURCE" | "EMPTY_SOURCE"
            - records_archived: int
            - archive_files: List[str] (paths to created archive JSONL files)
            - storage_dir: str
        """
        if not os.path.exists(self.source_log_path):
            return {
                "status": "MISSING_SOURCE",
                "records_archived": 0,
                "archive_files": [],
                "storage_dir": self.storage_dir,
                "message": f"Source audit log file not found at '{self.source_log_path}'",
            }

        records = self.read_source_records()
        if not records:
            return {
                "status": "EMPTY_SOURCE",
                "records_archived": 0,
                "archive_files": [],
                "storage_dir": self.storage_dir,
                "message": f"No valid audit records found in '{self.source_log_path}'",
            }

        now_utc = datetime.now(timezone.utc)
        year_str = now_utc.strftime("%Y")
        month_str = now_utc.strftime("%m")
        day_str = now_utc.strftime("%d")
        timestamp_str = now_utc.strftime("%Y%m%d_%H%M%S_%f")[:19]

        if partition_by_date:
            target_folder = os.path.join(
                self.storage_dir,
                "audit-logs",
                year_str,
                month_str,
                day_str,
            )
        else:
            target_folder = os.path.join(self.storage_dir, "audit-logs")

        os.makedirs(target_folder, exist_ok=True)

        prefix = custom_prefix or "audit"
        archive_filename = f"{prefix}_{timestamp_str}.jsonl"
        archive_filepath = os.path.join(target_folder, archive_filename)

        records_written = 0
        with open(archive_filepath, "w", encoding="utf-8") as f_out:
            for rec in records:
                f_out.write(json.dumps(rec) + "\n")
                records_written += 1

        logger.info(
            f"Successfully archived {records_written} audit records to simulated object storage: {archive_filepath}"
        )

        return {
            "status": "SUCCESS",
            "records_archived": records_written,
            "archive_files": [archive_filepath],
            "storage_dir": self.storage_dir,
            "message": f"Successfully archived {records_written} records to {archive_filepath}",
        }
