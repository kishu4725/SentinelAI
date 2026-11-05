"""
SentinelAI Real-Time WebSocket Manager
Orchestrates live backend-to-SOC Command Center alert propagation.
Broadcasts structured threat events evaluated by ML + SOAR to all connected SOC Admin clients.
"""

import asyncio
import logging
from typing import List, Dict, Any
from fastapi import WebSocket, WebSocketDisconnect

logger = logging.getLogger("SentinelAI.WebSocketManager")


class SOCWebSocketManager:
    """
    Manages active WebSocket connections to the SOC Command Center.
    Broadcasts real-time security events, threat evaluations, and SOAR responses.
    """

    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        """Accepts and stores an active SOC Admin WebSocket connection."""
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"🟢 SOC Admin WebSocket Client connected. Total active connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        """Removes a disconnected SOC Admin WebSocket connection."""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"🔴 SOC Admin WebSocket Client disconnected. Remaining connections: {len(self.active_connections)}")

    async def broadcast(self, message: Dict[str, Any]):
        """Asynchronously sends a JSON threat payload to all connected SOC Admin clients."""
        if not self.active_connections:
            return

        dead_connections = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as err:
                logger.warning(f"Failed to send WS message to client: {err}")
                dead_connections.append(connection)

        for dead in dead_connections:
            self.disconnect(dead)

    def broadcast_sync(self, message: Dict[str, Any]):
        """
        Thread-safe sync helper to schedule broadcast onto running event loop.
        Allows sync FastAPI endpoints and DB handlers to trigger WS broadcasts effortlessly.
        """
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(self.broadcast(message))
        except RuntimeError:
            try:
                asyncio.run(self.broadcast(message))
            except Exception as err:
                logger.error(f"Failed to broadcast WS notification: {err}")


# Global Singleton Instance
soc_ws_manager = SOCWebSocketManager()
