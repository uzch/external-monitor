from __future__ import annotations

from dataclasses import dataclass
from time import perf_counter
from typing import Any, Literal

import httpx

from .artifacts import ArtifactStore
from .config import Settings
from .store import IntelligenceStore

TavilyTopic = Literal["general", "news"]


@dataclass(frozen=True)
class TavilySearchResult:
    result_ids: list[str]
    query_id: str


@dataclass(frozen=True)
class TavilyExtractResult:
    artifact_id: str
    raw: dict[str, Any]
    latency_ms: int


class TavilyApiConnector:
    provider = "tavily_api"

    def __init__(self, settings: Settings, store: IntelligenceStore, artifacts: ArtifactStore):
        self.settings = settings
        self.store = store
        self.artifacts = artifacts

    async def search(
        self, run_id: str, plan_revision: int, query: str, rationale: str, topic: TavilyTopic
    ) -> TavilySearchResult:
        if not self.settings.tavily_api_configured:
            raise RuntimeError("Tavily direct API is not configured. Configure CM_TAVILY_API_KEY.")
        operation = f"tavily_api_{topic}_search"
        parameters = {
            "query": query,
            "topic": topic,
            "search_depth": "advanced",
            "max_results": 10,
            "include_raw_content": False,
        }
        query_record = self.store.record_query(
            run_id, plan_revision, query, rationale, self.provider, operation, parameters
        )
        started = perf_counter()
        async with httpx.AsyncClient(timeout=self.settings.tavily_api_timeout_ms / 1000) as client:
            response = await client.post(
                "https://api.tavily.com/search",
                headers={"Authorization": f"Bearer {self.settings.tavily_api_key}"},
                json=parameters,
            )
        raw = response.json()
        response.raise_for_status()
        latency_ms = round((perf_counter() - started) * 1000)
        artifact = self.store.record_artifact(
            run_id,
            "tavily_api_search_result",
            self.artifacts.put_json(run_id, "tavily_api_search_result", raw),
        )
        results = raw.get("results") if isinstance(raw, dict) else []
        if not isinstance(results, list):
            results = []
        result_ids = self.store.record_discovery_results(
            query_record.id,
            artifact.id,
            self.provider,
            operation,
            [self._normalize_result(result) for result in results if self._has_url(result)],
        )
        self.store.record_learning(
            run_id,
            "provider_operation",
            {
                "provider": self.provider,
                "operation": operation,
                "query_id": query_record.id,
                "result_count": len(result_ids),
                "latency_ms": latency_ms,
                "raw_artifact_id": artifact.id,
            },
        )
        return TavilySearchResult(result_ids=result_ids, query_id=query_record.id)

    async def extract(self, run_id: str, url: str) -> TavilyExtractResult:
        if not self.settings.tavily_api_configured:
            raise RuntimeError("Tavily direct API is not configured. Configure CM_TAVILY_API_KEY.")
        started = perf_counter()
        payload = {"urls": [url], "extract_depth": "advanced", "include_images": False}
        async with httpx.AsyncClient(timeout=self.settings.tavily_api_timeout_ms / 1000) as client:
            response = await client.post(
                "https://api.tavily.com/extract",
                headers={"Authorization": f"Bearer {self.settings.tavily_api_key}"},
                json=payload,
            )
        raw = response.json()
        response.raise_for_status()
        artifact = self.store.record_artifact(
            run_id,
            "tavily_api_extract_result",
            self.artifacts.put_json(run_id, "tavily_api_extract_result", raw),
            url,
        )
        latency_ms = round((perf_counter() - started) * 1000)
        self.store.record_learning(
            run_id,
            "provider_operation",
            {
                "provider": self.provider,
                "operation": "tavily_api_extract",
                "url": url,
                "latency_ms": latency_ms,
                "raw_artifact_id": artifact.id,
            },
        )
        return TavilyExtractResult(artifact_id=artifact.id, raw=raw, latency_ms=latency_ms)

    @staticmethod
    def _has_url(result: object) -> bool:
        return isinstance(result, dict) and isinstance(result.get("url"), str)

    @staticmethod
    def _normalize_result(result: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": result.get("id") or result.get("url"),
            "url": result["url"],
            "title": result.get("title"),
            "description": result.get("content"),
            "score": result.get("score"),
            "published_date": result.get("published_date"),
            "source": result.get("source"),
            "raw": result,
        }
