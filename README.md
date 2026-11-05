# SentinelAI

**AI-Driven Cloud Threat Intelligence System with Honeypot & Anomaly Detection**

---

## 📌 Project Overview
SentinelAI is a multi-component final-year project designed for real-time cloud threat intelligence, anomaly detection, honeypot telemetry ingestion, and interactive visualization.

---

## 📂 Project Structure

```text
SentinelAI/
├── admin-frontend/  # SOC Command Center & Threat Telemetry Dashboard (Port 5174)
├── user-frontend/   # End-User Security Portal & Account Monitoring (Port 5173)
├── backend/     # Backend API Service
├── ml/          # Machine Learning models, feature extraction & pipelines
├── cloud/       # Cloud infrastructure scripts and honeypot telemetry components
├── database/    # Database configurations & migration scripts
├── docs/        # Project documentation & architecture diagrams
└── tests/       # Integration & unit test suites
```

---

## 👥 Team & Responsibilities (4-Member Team)

| Role / Domain | Module Responsibility | Team Member |
| :--- | :--- | :--- |
| **Frontend & Visualization** | UI Dashboard, Real-Time Threat Feeds, Visual Metrics | Member 1 |
| **Backend & Integration** | API Services, Authentication, Data Aggregation | Member 2 |
| **Machine Learning & Analytics** | Threat Anomaly Detection, Feature Engineering, Model Pipelines | Member 3 |
| **Cloud & Honeypot Infrastructure** | Honeypot Deployment, Cloud Telemetry Ingestion, Infrastructure Setup | Member 4 |

---

## 🚀 Getting Started

All commands run from the project root (`SentinelAI/`).

### 1. Install

```bash
python -m venv .venv
# Windows PowerShell:  .venv\Scripts\Activate.ps1      macOS/Linux:  source .venv/bin/activate
pip install -r requirements-dev.txt
```

### 2. Configure

```bash
cp .env.example .env        # Windows: copy .env.example .env
```

Then edit `.env`: set `SECRET_KEY`, `SENTINEL_SENSOR_API_KEY`, and `DATABASE_URL`
(the default is SQLite, which needs no database server). Generate secrets with
`python -c "import secrets; print(secrets.token_urlsafe(48))"`.

### 3. Check the environment

```bash
python scripts/check_env.py
```

This verifies packages, secrets, database connectivity, and that the Isolation Forest model really loads.
If the model is missing or incompatible the backend still starts, but scores with **rules only**.
Train it with `python ml/train.py`.

### 4. Run

```bash
uvicorn backend.app.main:app --reload --port 8000        # API: http://127.0.0.1:8000/docs
cd admin-frontend && npm install && npm run dev           # SOC dashboard (5174)
cd user-frontend  && npm install && npm run dev           # user portal (5173)
```

`GET /api/health` reports database status and whether the ML model is in use.

### 5. Send a test event (sensors authenticate with `X-API-Key`)

```bash
curl -X POST http://127.0.0.1:8000/api/events/ingest \
  -H "Content-Type: application/json" -H "X-API-Key: <SENTINEL_SENSOR_API_KEY>" \
  -d '{"event_type":"LOGIN_FAILED","source_ip":"198.51.100.20","details":{"failed_count":15}}'
```

The server computes the risk score itself; a `details.risk_score` sent by a client is ignored
unless `SENTINEL_TRUST_CLIENT_RISK_SCORE=true` (demo/test only).

### 6. Honeypots (optional, needs the backend running)

```bash
python honeypot/http/http_honeypot.py
python honeypot/simulator/attack_simulator.py --scenario ssh_bruteforce
```

See `honeypot/README.md` for all scenarios and what each should show on the dashboard.

### 7. Test

```bash
python -m pytest tests -q
```

### Security notes

- `/api/events/ingest` requires the sensor key; `/api/mitigation/*` and `/api/ws/soc` require a SOC admin login.
- Set `SENTINEL_ENV=production` to make the backend refuse to start without `SECRET_KEY` and `SOC_ADMIN_PASSWORD`.
- Without `SOC_ADMIN_PASSWORD` the seeded admin uses a well-known development password. Set it before exposing the backend.
