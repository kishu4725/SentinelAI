"""
Cloud Exporter Bridge Service
Archives event simulation and SOAR audit records into cloud/audit_logs.jsonl
"""

import json
import os
import logging

logger = logging.getLogger("SentinelAI.CloudExporter")


class CloudExporter:
    def __init__(self, log_path: str = "cloud/audit_logs.jsonl"):
        self.log_path = log_path

    def archive_record(self, record: dict) -> bool:
        try:
            folder = os.path.dirname(self.log_path)
            if folder:
                os.makedirs(folder, exist_ok=True)
            with open(self.log_path, "a", encoding="utf-8") as f:
                f.write(json.dumps(record) + "\n")
            return True
        except Exception as e:
            logger.error(f"Failed to archive record: {e}")
            return False


cloud_exporter = CloudExporter()
