"""
Unit Tests for SentinelAI Cloud Storage Exporter (Member 4 Cloud Integration)
"""

import os
import shutil
import tempfile
import json
import unittest

from cloud.cloud_storage_exporter import CloudStorageExporter


class TestCloudStorageExporter(unittest.TestCase):

    def setUp(self):
        self.test_dir = tempfile.mkdtemp()
        self.source_log = os.path.join(self.test_dir, "test_audit_logs.jsonl")
        self.storage_dir = os.path.join(self.test_dir, "object_storage")

        # Create sample source audit log
        self.sample_records = [
            {
                "log_id": "SOAR-LOG-00001",
                "timestamp": "2026-09-30T10:00:00+00:00",
                "event_id": "EVT-TEST-001",
                "source_ip": "198.51.100.55",
                "risk_score": 85.0,
                "action": "BLOCK",
                "policy_applied": "Critical Threat Blocklist",
                "dry_run": True,
                "summary": "Simulated block for IP 198.51.100.55",
                "metadata": {"cloud_provider": "AWS", "event_type": "IAM_ROLE_ESCALATION"}
            },
            {
                "log_id": "SOAR-LOG-00002",
                "timestamp": "2026-09-30T10:05:00+00:00",
                "event_id": "EVT-TEST-002",
                "source_ip": "192.168.1.10",
                "risk_score": 15.0,
                "action": "MONITOR",
                "policy_applied": "Routine Activity Monitoring",
                "dry_run": False,
                "summary": "Event logged under monitoring",
                "metadata": {"cloud_provider": "AWS", "event_type": "PASSWORD_CHANGE"}
            }
        ]

        with open(self.source_log, "w", encoding="utf-8") as f:
            for rec in self.sample_records:
                f.write(json.dumps(rec) + "\n")

        self.exporter = CloudStorageExporter(
            source_log_path=self.source_log,
            storage_dir=self.storage_dir
        )

    def tearDown(self):
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_valid_audit_log_export(self):
        """Verifies successful export of audit records to simulated object storage."""
        result = self.exporter.export_audit_logs()

        self.assertEqual(result["status"], "SUCCESS")
        self.assertEqual(result["records_archived"], 2)
        self.assertEqual(len(result["archive_files"]), 1)

        archive_path = result["archive_files"][0]
        self.assertTrue(os.path.exists(archive_path))

    def test_archive_directory_creation_and_partitioning(self):
        """Verifies date-partitioned folder structure (YYYY/MM/DD) creation."""
        result = self.exporter.export_audit_logs(partition_by_date=True)

        archive_path = result["archive_files"][0]
        self.assertIn(os.path.join(self.storage_dir, "audit-logs"), archive_path)
        # Check folder structure has audit-logs directory
        rel_path = os.path.relpath(archive_path, self.storage_dir)
        path_parts = rel_path.split(os.sep)
        self.assertEqual(path_parts[0], "audit-logs")
        self.assertEqual(len(path_parts), 5)  # audit-logs / YYYY / MM / DD / filename

    def test_preservation_of_jsonl_content(self):
        """Verifies exported file contains valid, matching JSONL lines."""
        result = self.exporter.export_audit_logs()
        archive_path = result["archive_files"][0]

        exported_records = []
        with open(archive_path, "r", encoding="utf-8") as f:
            for line in f:
                exported_records.append(json.loads(line.strip()))

        self.assertEqual(len(exported_records), 2)
        self.assertEqual(exported_records[0]["event_id"], "EVT-TEST-001")
        self.assertEqual(exported_records[1]["event_id"], "EVT-TEST-002")

    def test_original_audit_log_remains_unchanged(self):
        """Verifies original source audit_logs.jsonl is not modified or deleted during export."""
        with open(self.source_log, "r", encoding="utf-8") as f:
            content_before = f.read()

        self.exporter.export_audit_logs()

        with open(self.source_log, "r", encoding="utf-8") as f:
            content_after = f.read()

        self.assertEqual(content_before, content_after)

    def test_missing_source_handling(self):
        """Verifies graceful handling when source audit log file is missing."""
        missing_exporter = CloudStorageExporter(
            source_log_path=os.path.join(self.test_dir, "non_existent.jsonl"),
            storage_dir=self.storage_dir
        )
        result = missing_exporter.export_audit_logs()

        self.assertEqual(result["status"], "MISSING_SOURCE")
        self.assertEqual(result["records_archived"], 0)
        self.assertEqual(len(result["archive_files"]), 0)

    def test_empty_source_handling(self):
        """Verifies graceful handling when source audit log file is empty."""
        empty_log = os.path.join(self.test_dir, "empty.jsonl")
        open(empty_log, "w").close()

        empty_exporter = CloudStorageExporter(
            source_log_path=empty_log,
            storage_dir=self.storage_dir
        )
        result = empty_exporter.export_audit_logs()

        self.assertEqual(result["status"], "EMPTY_SOURCE")
        self.assertEqual(result["records_archived"], 0)
        self.assertEqual(len(result["archive_files"]), 0)

    def test_repeated_export_does_not_corrupt_data(self):
        """Verifies running export multiple times creates distinct timestamped files without corrupting data."""
        res1 = self.exporter.export_audit_logs()
        res2 = self.exporter.export_audit_logs()

        self.assertEqual(res1["status"], "SUCCESS")
        self.assertEqual(res2["status"], "SUCCESS")
        self.assertNotEqual(res1["archive_files"][0], res2["archive_files"][0])
        self.assertTrue(os.path.exists(res1["archive_files"][0]))
        self.assertTrue(os.path.exists(res2["archive_files"][0]))


if __name__ == "__main__":
    unittest.main()
