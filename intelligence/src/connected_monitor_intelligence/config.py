from __future__ import annotations

from pathlib import Path

from pydantic import Field, HttpUrl
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[3] / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
    )

    environment: str = Field(default="local", validation_alias="CM_ENVIRONMENT")
    database_url: str = Field(
        default="postgresql+psycopg://connected_monitor:connected_monitor@127.0.0.1:5432/connected_monitor",
        validation_alias="CM_INTELLIGENCE_DATABASE_URL",
    )
    temporal_address: str = Field(default="127.0.0.1:7233", validation_alias="CM_TEMPORAL_ADDRESS")
    temporal_namespace: str = Field(default="default", validation_alias="CM_TEMPORAL_NAMESPACE")
    temporal_task_queue: str = Field(
        default="connected-monitor-intelligence", validation_alias="CM_TEMPORAL_TASK_QUEUE"
    )
    artifact_endpoint: str = Field(default="http://127.0.0.1:9000", validation_alias="CM_ARTIFACT_ENDPOINT")
    artifact_access_key: str = Field(default="connected-monitor", validation_alias="CM_ARTIFACT_ACCESS_KEY")
    artifact_secret_key: str = Field(
        default="connected-monitor-local", validation_alias="CM_ARTIFACT_SECRET_KEY"
    )
    artifact_bucket: str = Field(default="intelligence-artifacts", validation_alias="CM_ARTIFACT_BUCKET")
    maas_base_url: HttpUrl | None = Field(default=None, validation_alias="CM_MAAS_BASE_URL")
    maas_api_key: str | None = Field(default=None, validation_alias="CM_MAAS_API_KEY")
    maas_model: str = Field(default="gpt-oss-120b", validation_alias="CM_MAAS_MODEL")
    maas_timeout_ms: int = Field(default=30000, validation_alias="CM_MAAS_TIMEOUT_MS", ge=1000, le=120000)
    maas_min_interval_ms: int = Field(
        default=1000, validation_alias="CM_MAAS_MIN_INTERVAL_MS", ge=0, le=10000
    )
    brave_api_key: str | None = Field(default=None, validation_alias="CM_BRAVE_SEARCH_API_KEY")
    brave_timeout_ms: int = Field(
        default=15000, validation_alias="CM_BRAVE_SEARCH_TIMEOUT_MS", ge=1000, le=60000
    )
    tavily_api_key: str | None = Field(default=None, validation_alias="CM_TAVILY_API_KEY")
    tavily_api_timeout_ms: int = Field(
        default=20000, validation_alias="CM_TAVILY_API_TIMEOUT_MS", ge=1000, le=120000
    )
    tavily_mcp_url: str | None = Field(default=None, validation_alias="CM_TAVILY_MCP_URL")
    tavily_mcp_token: str | None = Field(default=None, validation_alias="CM_TAVILY_MCP_TOKEN")
    tavily_mcp_timeout_ms: int = Field(
        default=20000, validation_alias="CM_TAVILY_MCP_TIMEOUT_MS", ge=1000, le=120000
    )
    retrieval_timeout_ms: int = Field(
        default=20000, validation_alias="CM_RETRIEVAL_TIMEOUT_MS", ge=1000, le=120000
    )
    retrieval_max_bytes: int = Field(
        default=8_000_000, validation_alias="CM_RETRIEVAL_MAX_BYTES", ge=1024, le=50_000_000
    )
    max_plan_revisions: int = Field(default=2, validation_alias="CM_MAX_PLAN_REVISIONS", ge=0, le=5)
    max_queries: int = Field(default=3, validation_alias="CM_MAX_RESEARCH_QUERIES", ge=1, le=30)
    max_resources: int = Field(default=4, validation_alias="CM_MAX_RESEARCH_RESOURCES", ge=1, le=100)
    max_candidate_claims: int = Field(
        default=4, validation_alias="CM_MAX_CANDIDATE_CLAIMS", ge=1, le=24
    )
    embedding_model: str = Field(default="BAAI/bge-small-en-v1.5", validation_alias="CM_EMBEDDING_MODEL")

    @property
    def maas_configured(self) -> bool:
        return bool(self.maas_base_url and self.maas_api_key and self.maas_model)

    @property
    def brave_configured(self) -> bool:
        return bool(self.brave_api_key)

    @property
    def tavily_api_configured(self) -> bool:
        return bool(self.tavily_api_key)

    @property
    def tavily_mcp_configured(self) -> bool:
        return bool(self.tavily_mcp_url)

    @property
    def discovery_configured(self) -> bool:
        return bool(self.tavily_api_configured or self.tavily_mcp_configured or self.brave_configured)


settings = Settings()
