"""Metadata for securely stored user files."""
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime
from backend.app.db.base import Base


class UserFile(Base):
    __tablename__ = "user_files"

    id = Column(String, primary_key=True, default=lambda: uuid.uuid4().hex)
    owner_id = Column(Integer, index=True, nullable=False)
    owner_username = Column(String, index=True, nullable=False)
    original_name = Column(String, nullable=False)
    ext = Column(String, nullable=False, default="")
    stored_key = Column(String, nullable=False)
    size_bytes = Column(Integer, nullable=False, default=0)
    sha256 = Column(String, nullable=False)
    status = Column(String, nullable=False, default="clean")  # clean | quarantined | deleted
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))