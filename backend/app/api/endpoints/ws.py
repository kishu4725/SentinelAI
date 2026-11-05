"""
WebSocket Endpoints (/api/ws)
Provides real-time bidirectional connection endpoint for SOC Command Center.
Connections require a valid SOC admin JWT, passed as ?token=<jwt>.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect, status
from starlette.concurrency import run_in_threadpool

from backend.app.core.security import decode_access_token
from backend.app.core.websocket import soc_ws_manager
from backend.app.db.session import SessionLocal
from backend.app.models.user import User

logger = logging.getLogger("SentinelAI.WSEndpoint")

router = APIRouter(prefix="/ws", tags=["WebSocket Telemetry Stream"])


def _is_active_admin_token(token: Optional[str]) -> bool:
    """True only for a valid JWT belonging to an active admin user."""
    if not token:
        return False

    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        return False

    db = SessionLocal()
    try:
        user = (
            db.query(User)
            .filter((User.username == payload["sub"]) | (User.email == payload["sub"]))
            .first()
        )
        return bool(user and user.is_active and user.role == "admin")
    finally:
        db.close()


@router.websocket("/soc")
async def soc_websocket_endpoint(
    websocket: WebSocket,
    token: Optional[str] = Query(default=None),
):
    """
    WebSocket Endpoint for SOC Command Center.
    Maintains active telemetry stream connection and broadcasts live security threat events.
    """
    if not await run_in_threadpool(_is_active_admin_token, token):
        logger.warning("Rejected unauthenticated SOC WebSocket connection attempt.")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await soc_ws_manager.connect(websocket)
    try:
        # Keep connection alive listening for ping/heartbeat or disconnects
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        soc_ws_manager.disconnect(websocket)
    except Exception as err:
        logger.warning(f"WebSocket connection error: {err}")
        soc_ws_manager.disconnect(websocket)
