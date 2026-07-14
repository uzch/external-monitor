from __future__ import annotations

from dataclasses import dataclass
from time import perf_counter
from typing import Any, Literal
from uuid import uuid4

import httpx

from .artifacts import ArtifactStore
from .config import Settings
from .store import IntelligenceStore

TavilyMcpTopic = Literal["general", "news"]


@dataclass(frozen=True)
class TavilyMcpSearchResult:
    result_ids: list[str]
    query_id: str


@dataclass(frozen=True)
class TavilyMcpExtractResult:
    artifact_id: str
    raw: dict[str, Any]
    latency_ms: int


class TavilyMcpConnector:
    provider = "tavily_mcp"

    def __init__(self, settings: Settings, store: IntelligenceStore, artifacts: ArtifactStore):
        self.settings = settings
        self.store = store
        self.artifacts = artifacts

    def declared_capabilities(self) -> dict[str, bool]:
        return {"search": True, "extract": True, "crawl": True, "map": True}

    async def search(
        self, run_id: str, plan_revision: int, query: str, rationale: str, topic: TavilyMcpTopic
    ) -> TavilyMcpSearchResult:
        operation = f"tavily_mcp_{topic}_search"
        parameters = {"query": query, "topic": topic, "search_depth": "advanced", "max_results": 10}
        query_record = self.store.record_query(
            run_id, plan_revision, query, rationale, self.provider, operation, parameters
        )
        raw, latency_ms = await self._call_tool(
            "tavily_search", {"query": query, "topic": topic, "search_depth": "advanced", "max_results": 10}
        )
        artifact = self.store.record_artifact(
            run_id,
            "tavily_mcp_search_result",
            self.artifacts.put_json(run_id, "tavily_mcp_search_result", raw),
        )
        results = self._extract_results(raw)
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
        return TavilyMcpSearchResult(result_ids=result_ids, query_id=query_record.id)

    async def extract(self, run_id: str, url: str) -> TavilyMcpExtractResult:
        raw, latency_ms = await self._call_tool("tavily_extract", {"urls": [url], "extract_depth": "advanced"})
        artifact = self.store.record_artifact(
            run_id,
            "tavily_mcp_extract_result",
            self.artifacts.put_json(run_id, "tavily_mcp_extract_result", raw),
            url,
        )
        self.store.record_learning(
            run_id,
            "provider_operation",
            {
                "provider": self.provider,
                "operation": "tavily_mcp_extract",
                "url": url,
                "latency_ms": latency_ms,
                "raw_artifact_id": artifact.id,
            },
        )
        return TavilyMcpExtractResult(artifact_id=artifact.id, raw=raw, latency_ms=latency_ms)

    async def _call_tool(self, name: str, arguments: dict[str, Any]) -> tuple[dict[str, Any], int]:
        if not self.settings.tavily_mcp_configured or not self.settings.tavily_mcp_url:
            raise RuntimeError("Tavily MCP is not configured. Configure CM_TAVILY_MCP_URL.")
        started = perf_counter()
        payload = {
            "jsonrpc": "2.0",
            "id": str(uuid4()),
            "method": "tools/call",
            "params": {"name": name, "arguments": arguments},
        }
        headers = {"Content-Type": "application/json"}
        if self.settings.tavily_mcp_token:
            headers["Authorization"] = f"Bearer {self.settings.tavily_mcp_token}"
        async with httpx.AsyncClient(timeout=self.settings.tavily_mcp_timeout_ms / 1000) as client:
            response = await client.post(self.settings.tavily_mcp_url, headers=headers, json=payload)
        raw = response.json()
        response.raise_for_status()
        if "error" in raw:
            raise RuntimeError(f"Tavily MCP tool call failed: {raw['error']}")
        return raw, round((perf_counter() - started) * 1000)

    @staticmethod
    def _extract_results(raw: dict[str, Any]) -> list[dict[str, Any]]:
        result = raw.get("result") if isinstance(raw, dict) else {}
        if isinstance(result, dict) and isinstance(result.get("results"), list):
            return [item for item in result["results"] if isinstance(item, dict)]
        content = result.get("content") if isinstance(result, dict) else None
        if isinstance(content, list):
            for item in content:
                if isinstance(item, dict) and isinstance(item.get("json"), dict):
                    nested = item["json"].get("results")
                    if isinstance(nested, list):
                        return [nested_item for nested_item in nested if isinstance(nested_item, dict)]
        return []

    @staticmethod
    def _has_url(result: object) -> bool:
        return isinstance(result, dict) and isinstance(result.get("url"), str)

    @staticmethod
    def _normalize_result(result: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": result.get("id") or result.get("url"),
            "url": result["url"],
            "title": result.get("title"),
            "description": result.get("content") or result.get("snippet"),
            "score": result.get("score"),
            "published_date": result.get("published_date"),
            "source": result.get("source"),
            "raw": result,
        }
