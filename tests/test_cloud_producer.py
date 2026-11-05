"""
Unit Tests for SentinelAI Cloud Event Producer (Member 4 Cloud Integration)
"""

import unittest
from unittest.mock import patch, MagicMock
import io
import json
import urllib.error

from cloud.cloud_event_producer import CloudEventProducer, CloudEventCategory


class TestCloudEventProducer(unittest.TestCase):

    def setUp(self):
        self.producer = CloudEventProducer(backend_url="http://127.0.0.1:8000")

    def test_payload_structure(self):
        """Verifies generated cloud event structure matches FastAPI EventIngestRequest schema."""
        payload = self.producer.generate_event(
            event_category=CloudEventCategory.IAM_ROLE_ESCALATION,
            source_ip="198.51.100.45",
            user_id="arn:aws:iam::123:user/test",
            custom_risk_score=88.5
        )

        self.assertEqual(payload["event_type"], CloudEventCategory.IAM_ROLE_ESCALATION)
        self.assertEqual(payload["source_ip"], "198.51.100.45")
        self.assertEqual(payload["user_id"], "arn:aws:iam::123:user/test")
        self.assertIn("device", payload)
        self.assertIn("location", payload)
        self.assertIn("details", payload)
        self.assertEqual(payload["details"]["cloud_provider"], "AWS")
        self.assertEqual(payload["details"]["risk_score"], 88.5)
        self.assertIn("timestamp", payload["details"])

    def test_all_supported_event_categories(self):
        """Verifies event generation for all 4 supported cloud event categories."""
        categories = [
            CloudEventCategory.IAM_ROLE_ESCALATION,
            CloudEventCategory.UNAUTHORIZED_API_CALL,
            CloudEventCategory.CLOUD_BRUTE_FORCE,
            CloudEventCategory.PUBLIC_BUCKET_EXPOSURE,
        ]

        for cat in categories:
            payload = self.producer.generate_event(event_category=cat)
            self.assertEqual(payload["event_type"], cat)
            self.assertIn("details", payload)
            self.assertIn("api_name", payload["details"])
            self.assertIn("resource", payload["details"])

    @patch("urllib.request.urlopen")
    def test_successful_http_transmission_mocked(self, mock_urlopen):
        """Verifies successful event transmission using mocked HTTP client."""
        mock_response = MagicMock()
        mock_response.read.return_value = json.dumps({
            "message": "Event successfully ingested",
            "threat_record": {"event_id": "EVT-MOCK-101", "risk_score": 85.0}
        }).encode('utf-8')
        mock_response.__enter__.return_value = mock_response
        mock_urlopen.return_value = mock_response

        payload = self.producer.generate_event(event_category=CloudEventCategory.IAM_ROLE_ESCALATION)
        response = self.producer.send_event(payload=payload)

        self.assertIn("message", response)
        self.assertEqual(response["threat_record"]["event_id"], "EVT-MOCK-101")
        mock_urlopen.assert_called_once()

    @patch("urllib.request.urlopen")
    def test_http_error_handling_mocked(self, mock_urlopen):
        """Verifies handling of backend HTTP 500 error."""
        error_file = io.BytesIO(b'{"detail": "Internal Server Error"}')
        http_error = urllib.error.HTTPError(
            url="http://127.0.0.1:8000/api/events/ingest",
            code=500,
            msg="Internal Server Error",
            hdrs={},
            fp=error_file
        )
        mock_urlopen.side_effect = http_error

        with self.assertRaises(RuntimeError) as ctx:
            self.producer.send_event(event_category=CloudEventCategory.IAM_ROLE_ESCALATION)

        self.assertIn("Backend HTTP error 500", str(ctx.exception))

    @patch("urllib.request.urlopen")
    def test_connection_error_handling_mocked(self, mock_urlopen):
        """Verifies handling of backend connection error."""
        url_error = urllib.error.URLError(reason="Connection refused")
        mock_urlopen.side_effect = url_error

        with self.assertRaises(ConnectionError) as ctx:
            self.producer.send_event(event_category=CloudEventCategory.IAM_ROLE_ESCALATION)

        self.assertIn("Could not connect to backend", str(ctx.exception))


if __name__ == "__main__":
    unittest.main()
