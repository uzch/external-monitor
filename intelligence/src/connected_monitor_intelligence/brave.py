from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

import httpx

from .artifacts import ArtifactStore
from .config import Settings
from .store import IntelligenceStore

SearchKind = Literal["web", "news"]


@dataclass(frozen=True)
class BraveSearchResult:
    result_ids: list[str]
    query_id: str


class BraveDiscovery:
    def __init__(self, settings: Settings, store: IntelligenceStore, artifacts: ArtifactStore):
        self.settings = settings
        self.store = store
        self.artifacts = artifacts

    async def search(
        self, run_id: str, plan_revision: int, query: str, rationale: str, kind: SearchKind
    ) -> BraveSearchResult:
        if not self.settings.brave_configured:
            raise RuntimeError("Brave discovery is not configured. Configure CM_BRAVE_SEARCH_API_KEY.")
        operation = f"brave_{kind}_search"
        parameters = {"q": query, "count": 10, "freshness": "pm"}
        query_record = self.store.record_query(
            run_id, plan_revision, query, rationale, "brave", operation, parameters
        )
        endpoint = f"https://api.search.brave.com/res/v1/{kind}/search"
        async with httpx.AsyncClient(timeout=self.settings.brave_timeout_ms / 1000) as client:
            response = await client.get(
                endpoint,
                params=parameters,
                headers={"Accept": "application/json", "X-Subscription-Token": self.settings.brave_api_key},
            )
        raw = response.json()
        response.raise_for_status()
        artifact = self.store.record_artifact(
            run_id, "brave_provider_result", self.artifacts.put_json(run_id, "brave_provider_result", raw)
        )
        results = raw.get("web", {}).get("results") if kind == "web" else raw.get("results")
        if not isinstance(results, list):
            results = []
        result_ids = self.store.record_discovery_results(
            query_record.id,
            artifact.id,
            "brave",
            operation,
            [result for result in results if isinstance(result, dict) and isinstance(result.get("url"), str)],
        )
        self.store.record_learning(
            run_id,
            "discovery_execution",
            {
                "query_id": query_record.id,
                "provider": "brave",
                "operation": operation,
                "result_count": len(result_ids),
                "raw_artifact_id": artifact.id,
            },
        )
        return BraveSearchResult(result_ids=result_ids, query_id=query_record.id)
