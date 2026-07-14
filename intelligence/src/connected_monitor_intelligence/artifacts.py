from __future__ import annotations

from hashlib import sha256
from io import BytesIO
from uuid import uuid4

import boto3
from botocore.client import Config

from .config import Settings


class ArtifactStore:
    def __init__(self, settings: Settings):
        self.bucket = settings.artifact_bucket
        self.client = boto3.client(
            "s3",
            endpoint_url=settings.artifact_endpoint,
            aws_access_key_id=settings.artifact_access_key,
            aws_secret_access_key=settings.artifact_secret_key,
            config=Config(signature_version="s3v4"),
            region_name="us-east-1",
        )

    def ensure_bucket(self) -> None:
        try:
            self.client.head_bucket(Bucket=self.bucket)
        except Exception:
            self.client.create_bucket(Bucket=self.bucket)

    def put_bytes(self, run_id: str, artifact_class: str, content_type: str, body: bytes) -> dict:
        digest = sha256(body).hexdigest()
        key = f"runs/{run_id}/{artifact_class}/{uuid4()}-{digest[:16]}"
        self.client.upload_fileobj(
            BytesIO(body),
            self.bucket,
            key,
            ExtraArgs={
                "ContentType": content_type,
                "Metadata": {"sha256": digest, "artifact-class": artifact_class},
            },
        )
        return {"object_key": key, "sha256": digest, "byte_count": len(body), "content_type": content_type}

    def put_json(self, run_id: str, artifact_class: str, payload: object) -> dict:
        import json

        return self.put_bytes(
            run_id,
            artifact_class,
            "application/json",
            json.dumps(payload, ensure_ascii=True, sort_keys=True, separators=(",", ":")).encode(),
        )
