"""
HTTP Honeypot.

Serves fake admin/login/bait pages, logs every request locally (honeypot/logs/http_logs.json,
the format log_converter.py reads) and reports it to the SentinelAI backend through the sensor
client. The honeypot never accepts a login. Passwords are never stored or sent: only their
length is kept.

Run from anywhere:  python honeypot/http/http_honeypot.py

Environment (.env or shell):
  SENTINEL_SENSOR_API_KEY   key the backend expects in X-API-Key (events are local-only without it)
  SENTINELAI_BACKEND_URL    default http://127.0.0.1:8000
  HONEYPOT_HTTP_HOST/PORT   default 127.0.0.1 / 8080
  HONEYPOT_TRUST_XFF=true   DEMO ONLY: take the source IP from X-Forwarded-For (spoofable)
  HONEYPOT_DEMO_GEO=true    DEMO ONLY: assign fake cities to RFC 5737 test IPs for the attack map
"""
import ipaddress
import os
import sys
from datetime import datetime
from pathlib import Path

from flask import Flask, make_response, request

# Allow `python honeypot/http/http_honeypot.py` (script mode) to import the honeypot package.
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from honeypot.common.classifiers import LOGIN_PATHS, PASSWORD_FIELDS, USERNAME_FIELDS  # noqa: E402
from honeypot.common.logstore import LOG_DIR, append_json_log  # noqa: E402
from honeypot.common.reporter import HoneypotReporter, clean  # noqa: E402
from honeypot.common.sensor_client import build_client_from_env  # noqa: E402

METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]

HOME_HTML = """
    <h1>Welcome</h1>
    <p>Server is running.</p>
    """
ADMIN_HTML = """
    <h1>Admin Login</h1>
    <form method="POST">
        Username: <input type="text" name="username"><br><br>
        Password: <input type="password" name="password"><br><br>
        <input type="submit" value="Login">
    </form>
    """
LOGIN_HTML = """
    <h1>Login Page</h1>
    <p>This is a simulated login page for the honeypot.</p>
    """
TEST_HTML = """
    <h1>Test Endpoint</h1>
    <p>HTTP Honeypot is working.</p>
    """
FAKE_LOGIN_HTML = """
    <h1>Sign in</h1>
    <form method="POST">
        <input type="text" name="log" placeholder="Username"><br><br>
        <input type="password" name="pwd" placeholder="Password"><br><br>
        <input type="submit" value="Log In">
    </form>
    """
DECOY_TEXT = "# decoy file - contains no real credentials\nAPP_ENV=production\nDB_PASSWORD=decoy-not-a-real-secret\n"
NOT_FOUND_HTML = "<h1>404 Not Found</h1><p>The requested URL was not found on this server.</p>"

PAGES = {
    "/": HOME_HTML,
    "/admin": ADMIN_HTML,
    "/login": LOGIN_HTML,
    "/test": TEST_HTML,
    "/wp-login.php": FAKE_LOGIN_HTML,
    "/wp-admin": FAKE_LOGIN_HTML,
    "/phpmyadmin": FAKE_LOGIN_HTML,
    "/administrator": FAKE_LOGIN_HTML,
}
DECOY_PATHS = {"/config", "/backup", "/.env"}


def _env_flag(name: str) -> bool:
    return os.getenv(name, "false").strip().lower() in ("1", "true", "yes", "on")


def create_app(reporter=None, log_file=None, trust_xff=None) -> Flask:
    """Application factory. reporter=None means local logging only."""
    app = Flask(__name__)
    app.config["MAX_CONTENT_LENGTH"] = 64 * 1024  # cap request bodies
    log_path = Path(log_file) if log_file else LOG_DIR / "http_logs.json"
    use_xff = _env_flag("HONEYPOT_TRUST_XFF") if trust_xff is None else trust_xff

    def client_ip() -> str:
        if use_xff:
            forwarded = request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
            try:
                return str(ipaddress.ip_address(forwarded))
            except ValueError:
                pass
        return request.remote_addr or "0.0.0.0"

    def read_body_fields() -> dict:
        fields = {}
        if request.form:
            fields.update(request.form.to_dict())
        else:
            data = request.get_json(silent=True)
            if isinstance(data, dict):
                fields.update({str(k): v for k, v in data.items() if isinstance(v, (str, int, float))})
        return {str(k): str(v) for k, v in fields.items()}

    @app.route("/", defaults={"path": ""}, methods=METHODS)
    @app.route("/<path:path>", methods=METHODS)
    def handle(path):
        req_path = "/" + path
        key = req_path.rstrip("/") or "/"
        ip = client_ip()
        user_agent = request.headers.get("User-Agent", "")
        query = request.query_string.decode("utf-8", "ignore")

        fields = read_body_fields() if request.method in ("POST", "PUT", "PATCH") else {}
        lowered = {k.lower(): v for k, v in fields.items()}
        username = next((lowered[k] for k in USERNAME_FIELDS if k in lowered), None)
        password = next((lowered[k] for k in PASSWORD_FIELDS if k in lowered), None)
        body = "&".join(f"{k}={v}" for k, v in fields.items() if k.lower() not in PASSWORD_FIELDS)
        is_login_attempt = request.method == "POST" and key in LOGIN_PATHS

        record = {
            "timestamp": datetime.now().isoformat(),
            "ip": ip,
            "protocol": "HTTP",
            "method": request.method,
            "request": request.path,
            "user_agent": user_agent,
            "event": "login_attempt" if is_login_attempt else "http_request",
        }
        if query:
            record["query"] = clean(query, 300)
        if is_login_attempt:
            record.update({
                "username": clean(username or "", 64),
                "login_success": False,
                "password_length": len(password) if password is not None else 0,
            })
        append_json_log(log_path, record)

        if reporter is not None:
            try:
                reporter.http_request(
                    ip=ip, method=request.method, path=request.path, query=query,
                    user_agent=user_agent, username=username, password=password,
                    body=body, is_login_attempt=is_login_attempt,
                )
            except Exception as err:  # reporting must never break the honeypot
                app.logger.warning("Failed to report event: %s", err)

        if key in DECOY_PATHS:
            resp = make_response(DECOY_TEXT)
            resp.headers["Content-Type"] = "text/plain; charset=utf-8"
            return resp
        if key in PAGES:
            return PAGES[key]
        return make_response(NOT_FOUND_HTML, 404)

    return app


def main() -> None:
    client = build_client_from_env()
    reporter = HoneypotReporter(client, sensor_name="http-honeypot")
    app = create_app(reporter=reporter)

    host = os.getenv("HONEYPOT_HTTP_HOST", "127.0.0.1")
    port = int(os.getenv("HONEYPOT_HTTP_PORT", "8080"))

    print("===================================")
    print("   HTTP HONEYPOT STARTED")
    print(f"   http://{host}:{port}")
    print(f"   backend sensor: {'ENABLED -> ' + client.ingest_url if client.enabled else 'DISABLED (set SENTINEL_SENSOR_API_KEY)'}")
    if _env_flag("HONEYPOT_TRUST_XFF"):
        print("   WARNING: HONEYPOT_TRUST_XFF is on (demo only: source IPs can be spoofed)")
    print("===================================")
    try:
        app.run(host=host, port=port, debug=False, threaded=True)
    finally:
        client.flush(5)
        client.close()


if __name__ == "__main__":
    main()
