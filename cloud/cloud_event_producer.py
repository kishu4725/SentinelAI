"""
SentinelAI Cloud Event Producer Module (Member 4 Cloud Integration)
Generates and transmits structured cloud security telemetry events (e.g., AWS CloudTrail, GCP Audit Logs)
conforming to the FastAPI /api/events/ingest API contract.
"""

import json
import logging
import os
import random
import urllib.request
import urllib.error
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

logger = logging.getLogger("SentinelAI.CloudProducer")


class CloudEventCategory:
    IAM_ROLE_ESCALATION = "IAM_ROLE_ESCALATION"
    UNAUTHORIZED_API_CALL = "UNAUTHORIZED_API_CALL"
    CLOUD_BRUTE_FORCE = "CLOUD_BRUTE_FORCE"
    PUBLIC_BUCKET_EXPOSURE = "PUBLIC_BUCKET_EXPOSURE"


CLOUD_EVENT_TEMPLATES: Dict[str, Dict[str, Any]] = {
    CloudEventCategory.IAM_ROLE_ESCALATION: {
        "event_type": "IAM_ROLE_ESCALATION",
        "cloud_provider": "AWS",
        "device": "AWS-CloudTrail/1.0",
        "browser": "boto3/1.28.0",
        "location": "us-east-1 (N. Virginia)",
        "source_country": "United States",
        "source_region": "Virginia",
        "source_city": "Ashburn",
        "source_lat": 39.0438,
        "source_lng": -77.4874,
        "target_city": "AWS Cloud Services",
        "default_risk_score": 85.0,
        "details_template": {
            "api_name": "AssumeRoleWithSAML",
            "resource": "arn:aws:iam::123456789012:role/AdministratorAccess",
            "principal": "arn:aws:iam::123456789012:user/temp_contractor",
            "severity": "HIGH",
            "message": "Unusual IAM role escalation detected outside standard operational window."
        }
    },
    CloudEventCategory.UNAUTHORIZED_API_CALL: {
        "event_type": "UNAUTHORIZED_API_CALL",
        "cloud_provider": "GCP",
        "device": "GCP-AuditLogs/2.0",
        "browser": "gcloud-sdk/450.0.0",
        "location": "europe-west3 (Frankfurt)",
        "source_country": "Germany",
        "source_region": "Hesse",
        "source_city": "Frankfurt",
        "source_lat": 50.1109,
        "source_lng": 8.6821,
        "target_city": "GCP Cloud Console",
        "default_risk_score": 90.0,
        "details_template": {
            "api_name": "compute.instances.setMetadata",
            "resource": "projects/sentinelai-prod/zones/europe-west3-a/instances/db-primary",
            "principal": "untrusted-sa@external.gserviceaccount.com",
            "severity": "CRITICAL",
            "message": "AccessDenied: Principal lacks resourcemanager.organization.setIamPolicy permission."
        }
    },
    CloudEventCategory.CLOUD_BRUTE_FORCE: {
        "event_type": "CLOUD_BRUTE_FORCE",
        "cloud_provider": "AWS",
        "device": "AWS-GuardDuty/1.0",
        "browser": "SSH/2.0-OpenSSH_8.9",
        "location": "ap-south-1 (Mumbai)",
        "source_country": "India",
        "source_region": "Maharashtra",
        "source_city": "Mumbai",
        "source_lat": 19.0760,
        "source_lng": 72.8777,
        "target_city": "Bengaluru VPC",
        "default_risk_score": 95.0,
        "details_template": {
            "api_name": "SSH_AUTHENTICATION_FAILURE",
            "resource": "i-0a123b456c789def0 (EC2 Bastion Host)",
            "principal": "root",
            "failed_attempts": 240,
            "severity": "CRITICAL",
            "message": "High-frequency SSH credential brute-force probe detected on exposed bastion node."
        }
    },
    CloudEventCategory.PUBLIC_BUCKET_EXPOSURE: {
        "event_type": "PUBLIC_BUCKET_EXPOSURE",
        "cloud_provider": "AWS",
        "device": "AWS-Config/1.0",
        "browser": "aws-cli/2.13.0",
        "location": "us-west-2 (Oregon)",
        "source_country": "United States",
        "source_region": "Oregon",
        "source_city": "Portland",
        "source_lat": 45.5152,
        "source_lng": -122.6784,
        "target_city": "S3 Global Endpoint",
        "default_risk_score": 88.0,
        "details_template": {
            "api_name": "PutBucketPolicy",
            "resource": "arn:aws:s3:::sentinelai-customer-backups-2026",
            "principal": "arn:aws:iam::123456789012:user/dev_ops",
            "severity": "HIGH",
            "message": "S3 Bucket policy modified to allow wildcard (*) Principal access to sensitive objects."
        }
    }
}


class CloudEventProducer:
    """
    SentinelAI Cloud Security Event Telemetry Producer.
    Generates structured simulated cloud security audit events and transmits them
    to the FastAPI backend /api/events/ingest endpoint.
    """

    def __init__(self, backend_url: Optional[str] = None):
        self.backend_url = (
            backend_url
            or os.getenv("SENTINELAI_BACKEND_URL")
            or os.getenv("BACKEND_URL")
            or "http://127.0.0.1:8000"
        ).rstrip('/')

    def generate_event(
        self,
        event_category: str = CloudEventCategory.IAM_ROLE_ESCALATION,
        source_ip: Optional[str] = None,
        user_id: Optional[str] = None,
        custom_risk_score: Optional[float] = None,
        custom_details: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Generates a structured cloud security event payload conforming to EventIngestRequest.
        """
        if event_category not in CLOUD_EVENT_TEMPLATES:
            template = CLOUD_EVENT_TEMPLATES[CloudEventCategory.IAM_ROLE_ESCALATION]
            cat_name = str(event_category)
        else:
            template = CLOUD_EVENT_TEMPLATES[event_category]
            cat_name = event_category

        now_iso = datetime.now(timezone.utc).isoformat()
        selected_ip = source_ip or f"198.51.{random.randint(10, 200)}.{random.randint(2, 250)}"
        details = dict(template["details_template"])

        if custom_risk_score is not None:
            details["risk_score"] = float(custom_risk_score)
        else:
            details["risk_score"] = template["default_risk_score"]

        details["cloud_provider"] = template["cloud_provider"]
        details["timestamp"] = now_iso

        if custom_details:
            details.update(custom_details)

        principal_user = user_id or details.get("principal", "arn:aws:iam::123456789012:user/cloud_admin")

        payload = {
            "event_type": cat_name,
            "user_id": principal_user,
            "source_ip": selected_ip,
            "device": template["device"],
            "browser": template["browser"],
            "location": template["location"],
            "source_country": template["source_country"],
            "source_region": template["source_region"],
            "source_city": template["source_city"],
            "source_lat": template["source_lat"],
            "source_lng": template["source_lng"],
            "target_city": template["target_city"],
            "details": details,
        }
        return payload

    def send_event(
        self,
        payload: Optional[Dict[str, Any]] = None,
        event_category: str = CloudEventCategory.IAM_ROLE_ESCALATION,
    ) -> Dict[str, Any]:
        """
        Transmits a single event payload to POST /api/events/ingest.
        """
        if payload is None:
            payload = self.generate_event(event_category=event_category)

        ingest_url = f"{self.backend_url}/api/events/ingest"
        data_bytes = json.dumps(payload).encode('utf-8')

        headers = {"Content-Type": "application/json"}
        sensor_key = os.getenv("SENTINEL_SENSOR_API_KEY", "").strip()
        if sensor_key:
            headers["X-API-Key"] = sensor_key

        req = urllib.request.Request(
            ingest_url,
            data=data_bytes,
            headers=headers,
            method="POST",
        )

        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                resp_data = json.loads(response.read().decode('utf-8'))
                logger.info(f"Cloud event '{payload.get('event_type')}' successfully transmitted to {ingest_url}")
                return resp_data
        except urllib.error.HTTPError as err:
            err_body = err.read().decode('utf-8') if err.fp else str(err)
            logger.error(f"HTTPError {err.code} transmitting cloud event to {ingest_url}: {err_body}")
            raise RuntimeError(f"Backend HTTP error {err.code}: {err_body}") from err
        except urllib.error.URLError as err:
            logger.error(f"URLError connecting to backend at {ingest_url}: {err.reason}")
            raise ConnectionError(f"Could not connect to backend at {ingest_url}: {err.reason}") from err
        except Exception as err:
            logger.error(f"Unexpected error transmitting cloud event to {ingest_url}: {err}")
            raise

    def send_event_stream(
        self,
        categories: Optional[List[str]] = None,
        count: int = 4,
    ) -> List[Dict[str, Any]]:
        """
        Transmits a batch stream of cloud security events to the backend.
        """
        if categories is None:
            categories = [
                CloudEventCategory.IAM_ROLE_ESCALATION,
                CloudEventCategory.UNAUTHORIZED_API_CALL,
                CloudEventCategory.CLOUD_BRUTE_FORCE,
                CloudEventCategory.PUBLIC_BUCKET_EXPOSURE,
            ]

        results = []
        for i in range(count):
            cat = categories[i % len(categories)]
            payload = self.generate_event(event_category=cat)
            resp = self.send_event(payload=payload)
            results.append(resp)
        return results
