"""
HoneypotReporter: turns raw honeypot activity into backend ingest payloads.

  activity -> Sessionizer (cumulative per-IP counters) -> classifiers (event type)
           -> payload with explicit identity/geo fields -> SensorClient

Why explicit fields: the backend's EventIngestRequest defaults user_id to "alex_sentinel",
device to "Windows PC" and the origin to Mysuru, India. An event that omits them would be
attributed to your own user and would never be geolocated, so every payload sets them
(geo fields as explicit null so the backend's GeoIP enrichment runs).
"""
import os
import re
from datetime import datetime, timezone
from typing import Dict, List, Optional
from urllib.parse import unquote_plus

from honeypot.common.classifiers import (
    classify_command,
    classify_http,
)
from honeypot.common.demo_geo import demo_geo_for_ip
from honeypot.common.sensor_client import SensorClient
from honeypot.common.sessionizer import Sessionizer

_CONTROL_CHARS = re.compile(r"[\x00-\x1f\x7f]")


def clean(value, limit: int) -> str:
    """Printable, length-bounded copy of attacker-controlled text."""
    return _CONTROL_CHARS.sub("", str(value if value is not None else ""))[:limit]


class HoneypotReporter:
    def __init__(
        self,
        client: SensorClient,
        sessionizer: Optional[Sessionizer] = None,
        sensor_name: str = "honeypot",
        demo_geo: Optional[bool] = None,
        target_city: Optional[str] = None,
    ):
        self.client = client
        self.sessions = sessionizer or Sessionizer()
        self.sensor_name = sensor_name
        if demo_geo is None:
            demo_geo = os.getenv("HONEYPOT_DEMO_GEO", "false").strip().lower() in ("1", "true", "yes", "on")
        self.demo_geo = demo_geo
        self.target_city = target_city or os.getenv("HONEYPOT_TARGET_CITY") or None

    # ---- payload construction ----
    def _payload(self, event_type: str, ip: str, user_id: str, device: str, browser: str, details: Dict) -> Dict:
        details = dict(details)
        details["honeypot"] = self.sensor_name
        details["timestamp"] = datetime.now(timezone.utc).isoformat()

        geo = {"city": None, "country": None, "region": None, "lat": None, "lng": None}
        if self.demo_geo:
            fake = demo_geo_for_ip(ip)
            if fake:
                geo = fake
                details["geo_simulated"] = True

        payload = {
            "event_type": event_type,
            "user_id": clean(user_id, 64) or "unknown",
            "source_ip": ip,
            "device": device,
            "browser": clean(browser, 60) or "unknown",
            "location": None,
            "source_country": geo["country"],
            "source_region": geo["region"],
            "source_city": geo["city"],
            "source_lat": geo["lat"],
            "source_lng": geo["lng"],
            "details": details,
        }
        if self.target_city:
            payload["target_city"] = self.target_city
        return payload

    @staticmethod
    def _session_details(snap: Dict) -> Dict:
        return {
            "protocol": snap["protocol"],
            "failed_count": snap["failed_count"],
            "login_attempts": snap["login_attempts"],
            "command_count": snap["command_count"],
            "request_count": snap["request_count"],
            "session_duration": snap["session_duration"],
            "session_id": snap["session_id"],
        }

    def _emit(self, payload: Dict) -> Dict:
        self.client.send(payload)
        return payload

    # ---- SSH ----
    def ssh_login(self, ip: str, username: str, success: bool = False) -> List[Dict]:
        snap = self.sessions.record_login(ip, "SSH", clean(username, 64), success)
        details = self._session_details(snap)
        details.update({"login_success": bool(success), "is_login": True})
        # A *successful* login to a honeypot is more alarming than a failure, so it must not use
        # the plain LOGIN_SUCCESS name (the ML rules treat that as benign and cap its risk).
        event_type = "HONEYPOT_LOGIN_ACCEPTED" if success else "LOGIN_FAILED"
        return [self._emit(self._payload(event_type, ip, username, "honeypot-ssh", "ssh-client", details))]

    def ssh_command(self, ip: str, command: str) -> List[Dict]:
        snap = self.sessions.record_command(ip, "SSH")
        event_type, category = classify_command(command)
        details = self._session_details(snap)
        details.update({"command": clean(command, 200), "command_category": category})
        user = snap["last_username"] or "unknown"
        return [self._emit(self._payload(event_type, ip, user, "honeypot-ssh", "ssh-client", details))]

    # ---- HTTP ----
    def http_request(
        self,
        ip: str,
        method: str,
        path: str,
        query: str = "",
        user_agent: str = "",
        username: Optional[str] = None,
        password: Optional[str] = None,
        body: str = "",
        is_login_attempt: bool = False,
    ) -> List[Dict]:
        """
        `body` is the non-secret part of a POST body (field=value pairs without the password).
        `password` is only matched against injection patterns; it is never stored or sent.
        """
        snap = self.sessions.record_request(ip, is_login_attempt, clean(username, 64) if username else None)

        scan_text = " ".join(filter(None, [query, body, password]))
        event_type, tags, snippets = classify_http(method, path, scan_text, user_agent, is_login_attempt)

        # Decode the query: the backend's pattern checks run on plain text, not %-encoded text.
        shown_query = " ".join(filter(None, [clean(unquote_plus(query or ""), 300), clean(body, 200)]))
        for snip in snippets:  # make sure the ML adapter can see an injection hidden in a password field
            if snip and snip.lower() not in shown_query.lower():
                shown_query = f"{shown_query} {clean(snip, 80)}".strip()

        details = self._session_details(snap)
        details.update({
            "url": clean(path, 200),
            "query": shown_query,
            "method": clean(method, 10),
            "user_agent": clean(user_agent, 120),
            "tags": tags,
        })
        if is_login_attempt:
            details.update({"login_success": False, "is_login": True})
        if password is not None:
            details["password_length"] = len(password)  # length only, never the value

        user = username if username else "anonymous"
        sent = [self._emit(self._payload(event_type, ip, user, "honeypot-http", user_agent or "unknown", details))]

        if snap["rapid"]:
            burst = {
                "protocol": "HTTP",
                "request_count": snap["request_count"],
                "failed_count": snap["failed_count"],
                "command_count": 0,
                "session_duration": snap["session_duration"],
                "session_id": snap["session_id"],
                "window_seconds": self.sessions.rapid_window,
            }
            sent.append(self._emit(self._payload(
                "RAPID_RESOURCE_ACCESS", ip, user, "honeypot-http", user_agent or "unknown", burst
            )))
        return sent
