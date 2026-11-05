"""
SentinelAI environment check. Run from the project root:  python scripts/check_env.py
Exits 0 if everything required is OK, 1 otherwise. Warnings do not fail the check.
"""
import importlib
import os
import sys
import warnings
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

results = []  # (level, message)


def ok(msg): results.append(("OK", msg))
def warn(msg): results.append(("WARN", msg))
def fail(msg): results.append(("FAIL", msg))


# 1. Python version
if sys.version_info >= (3, 10):
    ok(f"Python {sys.version.split()[0]}")
else:
    fail(f"Python {sys.version.split()[0]} is too old; use 3.10+")

# 2. Required packages
PACKAGES = [
    ("fastapi", "fastapi"), ("uvicorn", "uvicorn"), ("sqlalchemy", "sqlalchemy"),
    ("pydantic", "pydantic"), ("email_validator", "email-validator (pydantic[email])"),
    ("jwt", "pyjwt"), ("bcrypt", "bcrypt"), ("dotenv", "python-dotenv"),
    ("sklearn", "scikit-learn"), ("joblib", "joblib"), ("pandas", "pandas"),
    ("numpy", "numpy"), ("flask", "flask"), ("websockets", "websockets (uvicorn[standard])"),
]
for module, label in PACKAGES:
    try:
        importlib.import_module(module)
        ok(f"package {label}")
    except ImportError:
        fail(f"package {label} is not installed -> pip install -r requirements.txt")

# 3. Environment variables (loads .env if python-dotenv is available)
try:
    from dotenv import load_dotenv
    load_dotenv(ROOT / ".env")
except ImportError:
    pass

if not (ROOT / ".env").exists():
    warn(".env not found; copy .env.example to .env")

secret = os.getenv("SECRET_KEY", "").strip()
if not secret:
    warn("SECRET_KEY not set: logins will be invalidated on every restart")
elif len(secret) < 32:
    warn("SECRET_KEY is shorter than 32 characters")
else:
    ok("SECRET_KEY set")

if os.getenv("SENTINEL_SENSOR_API_KEY", "").strip():
    ok("SENTINEL_SENSOR_API_KEY set")
else:
    fail("SENTINEL_SENSOR_API_KEY not set: /api/events/ingest will reject every sensor")

if not os.getenv("SOC_ADMIN_PASSWORD", "").strip():
    warn("SOC_ADMIN_PASSWORD not set: admin uses the well-known development password")

if os.getenv("SENTINEL_TRUST_CLIENT_RISK_SCORE", "false").strip().lower() in ("1", "true", "yes", "on"):
    warn("SENTINEL_TRUST_CLIENT_RISK_SCORE is on: clients can override the ML score (demo/test only)")

# 4. Database connectivity
try:
    from sqlalchemy import text
    from backend.app.db.session import engine
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    ok("database connection")
except Exception as err:
    fail(f"database connection failed ({type(err).__name__}); check DATABASE_URL")

# 5. ML model really loads (and with the scikit-learn version it was trained with)
try:
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always")
        from backend.app.services.ml_service import MLService
        status = MLService.model_status()
    if status["loaded"]:
        ok(f"ML model loaded ({status['model_version']}, {status['mode']})")
    else:
        fail(f"ML model NOT loaded -> scoring is rules-only. {status['reason']}")
    for w in caught:
        if "version" in str(w.message).lower() and "sklearn" in str(w.message).lower():
            warn("scikit-learn version differs from the one the model was trained with; "
                 "install the pinned version from requirements.txt")
            break
except Exception as err:
    fail(f"could not check the ML model ({type(err).__name__}: {err})")

for level, msg in results:
    print(f"[{level:4}] {msg}")
failed = sum(1 for lvl, _ in results if lvl == "FAIL")
print(f"\n{'FAILED' if failed else 'PASSED'}: {failed} failure(s), {sum(1 for l,_ in results if l=='WARN')} warning(s)")
sys.exit(1 if failed else 0)
