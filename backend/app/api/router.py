"""
Main API Router Aggregating All Sub-routers
"""

from fastapi import APIRouter
from backend.app.api.endpoints import auth, user_portal, soc_portal, events, mitigation, ws, files

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(user_portal.router)
api_router.include_router(soc_portal.router)
api_router.include_router(events.router)
api_router.include_router(mitigation.router)
api_router.include_router(ws.router)
api_router.include_router(files.router)
