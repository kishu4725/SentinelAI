"""Upload validation, Fernet encryption and RustFS (S3) storage."""
import hashlib
import io
import logging
import os
import re
import uuid
import zipfile
from dataclasses import dataclass

import boto3
from botocore.client import Config
from botocore.exceptions import ClientError
from cryptography.fernet import Fernet, InvalidToken

logger = logging.getLogger("SentinelAI.Files")

ALLOWED_EXT = {"pdf", "png", "jpg", "jpeg", "gif", "txt", "csv", "docx", "xlsx"}
BLOCKED_EXT = {
    "exe", "bat", "cmd", "com", "scr", "msi", "dll", "ps1", "vbs", "js", "jar",
    "sh", "php", "py", "html", "htm", "hta", "lnk", "reg", "apk",
}
EXEC_MAGIC = (b"MZ", b"\x7fELF", b"#!", b"\xca\xfe\xba\xbe", b"\xcf\xfa\xed\xfe")
SIGNATURES = {
    "pdf": (b"%PDF",),
    "png": (b"\x89PNG\r\n\x1a\n",),
    "jpg": (b"\xff\xd8\xff",),
    "jpeg": (b"\xff\xd8\xff",),
    "gif": (b"GIF87a", b"GIF89a"),
    "docx": (b"PK\x03\x04",),
    "xlsx": (b"PK\x03\x04",),
}


def max_bytes() -> int:
    return int(os.getenv("MAX_UPLOAD_MB", "10")) * 1024 * 1024


@dataclass
class Verdict:
    ok: bool
    code: str
    message: str
    risk: float
    safe_name: str
    ext: str


def inspect_upload(filename: str, data: bytes) -> Verdict:
    raw = filename or ""
    base = os.path.basename(raw.replace("\\", "/"))
    safe = re.sub(r"[^A-Za-z0-9._ -]", "_", base).strip(" .")[:100] or "file"
    ext = safe.rsplit(".", 1)[-1].lower() if "." in safe else ""

    def bad(code: str, msg: str, risk: float) -> Verdict:
        return Verdict(False, code, msg, risk, safe, ext)

    parts = re.split(r"[\\/]", raw)
    if "\x00" in raw or ".." in parts or len(parts) > 1:
        return bad("PATH_TRAVERSAL", "Invalid file name", 90)
    if len(data) > max_bytes():
        return bad("TOO_LARGE", f"File exceeds {max_bytes() // (1024 * 1024)} MB limit", 30)
    if len(data) == 0:
        return bad("EMPTY", "File is empty", 20)
    if ext in BLOCKED_EXT:
        return bad("DANGEROUS_TYPE", "This file type is not allowed", 70)
    inner = safe.lower().split(".")[1:-1]
    if any(p in BLOCKED_EXT for p in inner):
        return bad("DOUBLE_EXTENSION", "Suspicious double extension", 75)
    if ext not in ALLOWED_EXT:
        return bad("TYPE_NOT_ALLOWED", "This file type is not allowed", 40)
    if data.startswith(EXEC_MAGIC):
        return bad("FAKE_EXTENSION", "File content does not match its extension", 85)

    sigs = SIGNATURES.get(ext)
    if sigs:
        if not data.startswith(sigs):
            return bad("FAKE_EXTENSION", "File content does not match its extension", 85)
    elif b"\x00" in data[:8192]:  # txt / csv must be text
        return bad("FAKE_EXTENSION", "File content does not match its extension", 85)

    if ext in ("docx", "xlsx"):
        try:
            with zipfile.ZipFile(io.BytesIO(data)) as z:
                infos = z.infolist()
                if sum(i.file_size for i in infos) > 200 * 1024 * 1024:
                    return bad("ZIP_BOMB", "File rejected", 80)
                if any(i.filename.lower().endswith("vbaproject.bin") for i in infos):
                    return bad("MACRO", "Files with macros are not allowed", 75)
        except zipfile.BadZipFile:
            return bad("FAKE_EXTENSION", "File content does not match its extension", 85)

    return Verdict(True, "OK", "File accepted", 5.0, safe, ext)


# ---------- encryption ----------
def _fernet() -> Fernet:
    key = os.getenv("FILE_ENCRYPTION_KEY", "").strip()
    if not key:
        raise RuntimeError("FILE_ENCRYPTION_KEY is not set in .env")
    return Fernet(key.encode())


# ---------- RustFS / S3 ----------
_client = None


def _s3():
    global _client
    if _client is None:
        _client = boto3.client(
            "s3",
            endpoint_url=os.getenv("RUSTFS_ENDPOINT", "http://localhost:9000"),
            aws_access_key_id=os.getenv("RUSTFS_ACCESS_KEY", "rustfsadmin"),
            aws_secret_access_key=os.getenv("RUSTFS_SECRET_KEY", "rustfsadmin"),
            region_name="us-east-1",
            config=Config(
                signature_version="s3v4",
                s3={"addressing_style": "path"},
                connect_timeout=5,
                read_timeout=15,
                retries={"max_attempts": 2},
            ),
        )
    return _client


def _bucket() -> str:
    return os.getenv("RUSTFS_USER_BUCKET", "sentinelai-user-files")


def _ensure_bucket():
    try:
        _s3().head_bucket(Bucket=_bucket())
    except ClientError:
        _s3().create_bucket(Bucket=_bucket())


def store_encrypted(owner_id: int, data: bytes):
    """Encrypt and store. Returns (object_key, sha256_of_plaintext)."""
    _ensure_bucket()
    sha = hashlib.sha256(data).hexdigest()
    key = f"u{owner_id}/{uuid.uuid4().hex}.enc"
    _s3().put_object(Bucket=_bucket(), Key=key, Body=_fernet().encrypt(data))
    return key, sha


def load_decrypted(key: str) -> bytes:
    obj = _s3().get_object(Bucket=_bucket(), Key=key)
    blob = obj["Body"].read()
    try:
        return _fernet().decrypt(blob)
    except InvalidToken:
        raise ValueError("Stored object failed integrity check")


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def delete_object(key: str):
    _s3().delete_object(Bucket=_bucket(), Key=key)