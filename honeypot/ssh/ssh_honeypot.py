"""
SSH honeypot (simulation).

This is still a SIMULATION: it does not listen on a network port. It records simulated login
attempts and commands to honeypot/logs/ssh_logs.json (the format log_converter.py reads) and
reports them to the SentinelAI backend through the sensor client. A real listener replaces it in
the next step; the logging/reporting calls below will stay the same.

Run from anywhere:
  python honeypot/ssh/ssh_honeypot.py                       # original demo (3 failed logins, 3 commands)
  python honeypot/ssh/ssh_honeypot.py --brute-force 12      # 12 failed logins from one IP
"""
import argparse
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from honeypot.common.logstore import LOG_DIR, append_json_log  # noqa: E402
from honeypot.common.reporter import HoneypotReporter  # noqa: E402
from honeypot.common.sensor_client import build_client_from_env  # noqa: E402

LOG_FILE = LOG_DIR / "ssh_logs.json"

_reporter = None


def get_reporter() -> HoneypotReporter:
    """Builds the shared reporter on first use (reads .env, starts the sender thread)."""
    global _reporter
    if _reporter is None:
        _reporter = HoneypotReporter(build_client_from_env(), sensor_name="ssh-honeypot")
    return _reporter


def save_log(data):
    append_json_log(LOG_FILE, data)


def simulate_login(ip, username, success=False, reporter=None):
    save_log({
        "timestamp": datetime.now().isoformat(),
        "ip": ip,
        "protocol": "SSH",
        "username": username,
        "login_success": success,
        "event": "login_attempt",
    })
    (reporter or get_reporter()).ssh_login(ip, username, success)
    print(f"[SSH] Login attempt from {ip} using username: {username}")


def simulate_command(ip, command, reporter=None):
    save_log({
        "timestamp": datetime.now().isoformat(),
        "ip": ip,
        "protocol": "SSH",
        "command": command,
        "event": "command_activity",
    })
    (reporter or get_reporter()).ssh_command(ip, command)
    print(f"[SSH] Command activity from {ip}: {command}")


def main() -> None:
    parser = argparse.ArgumentParser(description="SSH honeypot simulation")
    parser.add_argument("--brute-force", type=int, metavar="N", help="simulate N failed logins from one IP")
    parser.add_argument("--ip", default="192.0.2.10", help="simulated attacker IP (default 192.0.2.10)")
    args = parser.parse_args()

    print("===================================")
    print("      SSH HONEYPOT SIMULATION")
    print("===================================")

    reporter = get_reporter()
    print(f"backend sensor: {'ENABLED -> ' + reporter.client.ingest_url if reporter.client.enabled else 'DISABLED (set SENTINEL_SENSOR_API_KEY)'}")

    if args.brute_force:
        users = ["admin", "root", "test", "user", "oracle", "ubuntu"]
        for i in range(args.brute_force):
            simulate_login(args.ip, users[i % len(users)], False)
    else:
        for name in ("admin", "root", "test"):
            simulate_login(args.ip, name, False)
        for cmd in ("whoami", "ls", "pwd"):
            simulate_command(args.ip, cmd)

    reporter.client.flush(10)
    reporter.client.close()
    print("\nSSH honeypot simulation completed.")
    print("Check honeypot/logs/ssh_logs.json")


if __name__ == "__main__":
    main()
