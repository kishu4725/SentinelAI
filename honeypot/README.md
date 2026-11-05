# Honeypot & Cybersecurity Module

## Project

AI-Driven Cloud Threat Intelligence System

## Module

Member 1 – Cybersecurity & Honeypot

## Objective

Collect structured attacker activity from honeypots and deliver it, live, to the SentinelAI backend for ML scoring, automated (simulated) response, audit logging and the SOC dashboard.

## How it flows

```
 HTTP honeypot (Flask) ──┐
 SSH honeypot (simulation)┼─> Sessionizer ─> classifiers ─> Sensor client ──> POST /api/events/ingest
 Attack simulator ───────┘   (per-IP counters)  (event type)   (X-API-Key)         │
        │                                                                           ▼
        └─> honeypot/logs/*.json  ──> log_converter.py ──> security_logs.csv     ML + policy + audit + dashboard
```

Every request/login/command is **always** written to `honeypot/logs/` (so nothing is lost if the backend is down) **and** reported to the backend.

## Components

| File | What it does |
|---|---|
| `http/http_honeypot.py` | Fake `/`, `/admin`, `/login`, `/test` plus bait routes (`/wp-login.php`, `/phpmyadmin`, `/.env`, `/config`, `/backup`); unknown paths return 404 but are still logged. Never accepts a login. |
| `ssh/ssh_honeypot.py` | SSH **simulation** (no listener yet). `--brute-force N` simulates N failed logins. |
| `simulator/attack_simulator.py` | Random activity by default, or named scenarios: `ssh_bruteforce`, `ssh_intrusion`, `http_scan`, `http_sqli`, `http_bruteforce`, `all`. |
| `common/sessionizer.py` | Per-(IP, protocol) counters: failed logins, commands, requests, duration, request-flood detection. |
| `common/classifiers.py` | Maps raw activity to the event types the ML service understands (SQLi, XSS, sensitive-file probe, scanner, command categories). |
| `common/reporter.py` | Builds the ingest payload (explicit identity/geo fields, decoded query, sanitised text). |
| `common/sensor_client.py` | Non-blocking sender with retries and a local spool (`logs/sensor_spool.jsonl`) that is replayed when the backend returns. |
| `common/demo_geo.py` | Demo-only fake cities for test IPs. |
| `log_converter.py` | Unchanged: JSON logs -> `security_logs.csv`. |

## Run

All commands from the project root, with the backend already running and `SENTINEL_SENSOR_API_KEY` set in `.env`
(the same value the backend uses).

```bash
python honeypot/http/http_honeypot.py                       # terminal 1: HTTP honeypot on 127.0.0.1:8080
python honeypot/simulator/attack_simulator.py --scenario ssh_bruteforce
python honeypot/simulator/attack_simulator.py --scenario http_sqli --target http://127.0.0.1:8080
```

For HTTP scenarios to appear as different attackers, start the honeypot with `HONEYPOT_TRUST_XFF=true`
(demo only). Add `HONEYPOT_DEMO_GEO=true` to put the simulated attackers on the attack map.

Without `SENTINEL_SENSOR_API_KEY` the honeypots still work and log locally; they print that the backend sensor is disabled.

## What the scenarios should produce

| Scenario | Expected result on the dashboard |
|---|---|
| `ssh_bruteforce` | 12 failed logins; risk climbs, **Critical (99.05) from the 10th** failure, simulated block |
| `ssh_intrusion` | Failures, then an **accepted login (High)**, then recon (low) and download / privilege / delete commands (Medium) |
| `http_scan` | Scanner-UA burst; a request-flood event (Medium) plus High for sensitive-file probes |
| `http_sqli` | Four injection requests, each **High** |
| `http_bruteforce` | 12 failed web logins; **Critical from the 10th** |

## Safety

- The HTTP honeypot never accepts a login and **never stores or sends passwords**, only their length.
- Attacker-controlled text is stripped of control characters and length-limited before it is stored or sent.
- The honeypot process only reads sensor settings from `.env` (`SENTINEL_SENSOR_*`, `SENTINELAI_BACKEND_URL`, `HONEYPOT_*`); it never loads the JWT key, database URL or SMTP password.
- `HONEYPOT_TRUST_XFF` and `HONEYPOT_DEMO_GEO` are demo switches. Leave them off on anything exposed to the internet.
- The SSH component is still a local simulation: no real SSH service is exposed.
