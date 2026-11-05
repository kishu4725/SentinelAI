import os, sys
from datetime import datetime, timezone
import boto3
from botocore.config import Config

endpoint = os.getenv("S3_ENDPOINT_URL", "http://127.0.0.1:9000")
bucket = os.getenv("S3_BUCKET", "sentinelai-audit-logs")
access = os.environ["S3_ACCESS_KEY"]
secret = os.environ["S3_SECRET_KEY"]

src = os.path.join("cloud", "audit_logs.jsonl")
if not os.path.exists(src) or os.path.getsize(src) == 0:
    print("No audit records yet. Run the backend and an attack simulation first.")
    sys.exit(1)

now = datetime.now(timezone.utc)
key = f"audit-logs/{now:%Y/%m/%d}/audit_{now:%Y%m%d_%H%M%S}.jsonl"

s3 = boto3.client("s3", endpoint_url=endpoint, aws_access_key_id=access,
                  aws_secret_access_key=secret,
                  config=Config(s3={"addressing_style": "path"}))
s3.upload_file(src, bucket, key)
print("Uploaded:", key)
for o in s3.list_objects_v2(Bucket=bucket).get("Contents", []):
    print(" -", o["Key"], o["Size"], "bytes")
