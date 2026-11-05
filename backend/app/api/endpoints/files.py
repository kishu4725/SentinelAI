"""Secure file endpoints (/api/files) with attack-pattern logging."""
import logging
import uuid
from datetime import datetime, timedelta, timezone
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from fastapi.responses import Response
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from backend.app.api.deps import get_current_admin, get_current_user
from backend.app.db.session import get_db
from backend.app.models.event import SecurityEvent
from backend.app.models.file_record import UserFile
from backend.app.models.user import User
from backend.app.services import file_service as fs
from backend.app.services.cloud_service import cloud_service

logger = logging.getLogger("SentinelAI.Files")
router = APIRouter(prefix="/files", tags=["Secure Files"])


def _ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def _level(risk: float) -> str:
    if risk >= 90:
        return "Critical"
    if risk >= 75:
        return "High"
    if risk >= 40:
        return "Medium"
    return "Normal"


def _since(minutes: float):
    return datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(minutes=minutes)


def _log(db: Session, user: User, request: Request, etype: str, status: str, risk: float, details=None):
    ev = SecurityEvent(
        event_id=f"evt-{uuid.uuid4().hex[:12]}",
        event_type=etype,
        user_id=user.username,
        source_ip=_ip(request),
        status=status,
        risk_score=float(risk),
        risk_level=_level(risk),
    )
    db.add(ev)
    if risk >= 70:
        user.security_score = max(0, (user.security_score or 0) - 5)
    db.commit()
    if risk >= 40:
        try:
            cloud_service.process_threat_telemetry(
                event_id=ev.event_id,
                source_ip=ev.source_ip,
                risk_score=risk,
                threat_type=etype,
                user_id=user.username,
                is_anomalous=risk >= 70,
                details=details or {},
            )
        except Exception:
            logger.exception("SOAR hand-off failed")
    return ev


def _iso(dt):
    if not dt:
        return None
    if dt.tzinfo is None:
        return dt.isoformat() + "Z"
    return dt.isoformat()


def _out(r: UserFile) -> dict:
    return {
        "id": r.id,
        "name": r.original_name,
        "ext": r.ext,
        "size_bytes": r.size_bytes,
        "sha256": r.sha256,
        "status": r.status,
        "owner": r.owner_username,
        "created_at": _iso(r.created_at),
    }


def _ev_out(e: SecurityEvent) -> dict:
    return {
        "event_id": e.event_id,
        "event_type": e.event_type,
        "user": e.user_id,
        "status": e.status,
        "risk_score": e.risk_score,
        "risk_level": e.risk_level,
        "source_ip": e.source_ip,
        "timestamp": _iso(e.timestamp),
    }


@router.post("/upload", status_code=201)
async def upload_file(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # Burst detection: 5+ upload attempts in the last 60 seconds
    burst = (
        db.query(SecurityEvent)
        .filter(
            SecurityEvent.user_id == user.username,
            or_(SecurityEvent.event_type == "FILE_UPLOAD", SecurityEvent.event_type.like("FILE_BLOCKED_%")),
            SecurityEvent.timestamp >= _since(1),
        )
        .count()
    )
    if burst >= 5:
        _log(db, user, request, "FILE_UPLOAD_BURST", "Blocked", 60, {"attempts_last_minute": burst})
        raise HTTPException(status_code=429, detail="Too many uploads. Please slow down.")

    data = await file.read(fs.max_bytes() + 1)
    verdict = fs.inspect_upload(file.filename, data)

    if not verdict.ok:
        recent_blocks = (
            db.query(SecurityEvent)
            .filter(
                SecurityEvent.user_id == user.username,
                SecurityEvent.event_type.like("FILE_BLOCKED_%"),
                SecurityEvent.timestamp >= _since(10),
            )
            .count()
        )
        risk = min(100.0, verdict.risk + 5 * recent_blocks)
        _log(
            db, user, request, f"FILE_BLOCKED_{verdict.code}", "Blocked", risk,
            {"filename": verdict.safe_name, "reason": verdict.code, "recent_blocks": recent_blocks},
        )
        code = 413 if verdict.code == "TOO_LARGE" else 400
        raise HTTPException(status_code=code, detail=f"Upload rejected: {verdict.message}")

    try:
        key, sha = fs.store_encrypted(user.id, data)
    except Exception:
        logger.exception("Secure storage failure")
        raise HTTPException(status_code=503, detail="Secure storage is unavailable")

    rec = UserFile(
        owner_id=user.id,
        owner_username=user.username,
        original_name=verdict.safe_name,
        ext=verdict.ext,
        stored_key=key,
        size_bytes=len(data),
        sha256=sha,
        status="clean",
    )
    db.add(rec)
    db.commit()
    _log(db, user, request, "FILE_UPLOAD", "Success", 5, {"file_id": rec.id})
    return _out(rec)


@router.get("")
def list_my_files(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = (
        db.query(UserFile)
        .filter(UserFile.owner_id == user.id, UserFile.status != "deleted")
        .order_by(UserFile.created_at.desc())
        .all()
    )
    return [_out(r) for r in rows]


@router.get("/security/activity")
def my_file_activity(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    events = (
        db.query(SecurityEvent)
        .filter(SecurityEvent.user_id == user.username, SecurityEvent.event_type.like("FILE_%"))
        .order_by(SecurityEvent.timestamp.desc())
        .limit(50)
        .all()
    )
    return {
        "security_score": user.security_score,
        "blocked_count": sum(1 for e in events if e.status == "Blocked"),
        "highest_risk": max([e.risk_score for e in events], default=0),
        "events": [_ev_out(e) for e in events],
    }


@router.get("/admin/all")
def admin_all_files(db: Session = Depends(get_db), admin: User = Depends(get_current_admin)):
    rows = db.query(UserFile).order_by(UserFile.created_at.desc()).limit(500).all()
    return [_out(r) for r in rows]


@router.get("/admin/flagged")
def admin_flagged(db: Session = Depends(get_db), admin: User = Depends(get_current_admin)):
    events = (
        db.query(SecurityEvent)
        .filter(SecurityEvent.event_type.like("FILE_%"), SecurityEvent.risk_score >= 40)
        .order_by(SecurityEvent.timestamp.desc())
        .limit(100)
        .all()
    )
    patterns = (
        db.query(SecurityEvent.user_id, func.count(SecurityEvent.id), func.max(SecurityEvent.risk_score))
        .filter(SecurityEvent.event_type.like("FILE_%"), SecurityEvent.risk_score >= 40)
        .group_by(SecurityEvent.user_id)
        .all()
    )
    return {
        "flagged_events": [_ev_out(e) for e in events],
        "user_patterns": [
            {"user": u, "flagged_events": c, "max_risk": m} for (u, c, m) in patterns
        ],
    }


def _get_authorized(db: Session, request: Request, user: User, file_id: str) -> UserFile:
    rec = db.query(UserFile).filter(UserFile.id == file_id, UserFile.status != "deleted").first()
    if not rec or (rec.owner_id != user.id and user.role != "admin"):
        # Same response either way, so attackers can't tell which IDs exist.
        _log(db, user, request, "FILE_ACCESS_DENIED", "Blocked", 80 if rec else 50, {"file_id": file_id})
        raise HTTPException(status_code=404, detail="File not found")
    return rec


@router.get("/{file_id}/download")
def download_file(
    file_id: str,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rec = _get_authorized(db, request, user, file_id)
    if rec.status == "quarantined":
        raise HTTPException(status_code=423, detail="File is quarantined")

    def tampered():
        rec.status = "quarantined"
        db.commit()
        _log(db, user, request, "FILE_TAMPERED", "Blocked", 95, {"file_id": rec.id})
        raise HTTPException(status_code=409, detail="File failed integrity check and was quarantined")

    try:
        data = fs.load_decrypted(rec.stored_key)
    except ValueError:
        tampered()
    except Exception:
        logger.exception("Secure storage failure")
        raise HTTPException(status_code=503, detail="Secure storage is unavailable")

    if fs.sha256_hex(data) != rec.sha256:
        tampered()

    _log(db, user, request, "FILE_DOWNLOAD", "Success", 5, {"file_id": rec.id})
    return Response(
        content=data,
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{quote(rec.original_name)}",
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "no-store",
        },
    )


@router.delete("/{file_id}")
def delete_file(
    file_id: str,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rec = _get_authorized(db, request, user, file_id)
    try:
        fs.delete_object(rec.stored_key)
    except Exception:
        logger.exception("Could not delete stored object")
    rec.status = "deleted"
    db.commit()
    _log(db, user, request, "FILE_DELETE", "Success", 5, {"file_id": rec.id})
    return {"deleted": True}