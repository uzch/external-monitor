from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest

from connected_monitor_intelligence.config import Settings
from connected_monitor_intelligence.contracts import AccountContext
from connected_monitor_intelligence.pipeline import IntelligencePipeline
from connected_monitor_intelligence.tavily_api import TavilySearchResult


def test_readiness_accepts_tavily_api_without_brave() -> None:
    settings = Settings(
        _env_file=None,
        maas_base_url="https://maas.example.test/v1",
        maas_api_key="local-secret",
        maas_model="gpt-oss-120b",
        tavily_api_key="local-secret",
        brave_api_key=None,
    )

    assert IntelligencePipeline(settings).validate_readiness() == []


def test_readiness_reports_missing_discovery_provider() -> None:
    settings = Settings(
        _env_file=None,
        maas_base_url="https://maas.example.test/v1",
        maas_api_key="local-secret",
        maas_model="gpt-oss-120b",
        tavily_api_key=None,
        tavily_mcp_url=None,
        brave_api_key=None,
    )

    assert IntelligencePipeline(settings).validate_readiness() == [
        "No live discovery provider is configured."
    ]


@pytest.mark.asyncio
async def test_valid_empty_direct_search_does_not_consume_fallback_provider() -> None:
    configured = Settings(
        _env_file=None,
        maas_base_url="https://maas.example.test/v1",
        maas_api_key="local-secret",
        tavily_api_key="local-secret",
        tavily_mcp_url="https://mcp.example.test",
    )
    pipeline = object.__new__(IntelligencePipeline)
    pipeline.settings = configured
    pipeline.store = SimpleNamespace(record_learning=Mock())
    pipeline.tavily_api = SimpleNamespace(
        search=AsyncMock(return_value=TavilySearchResult(result_ids=[], query_id="query-1"))
    )
    pipeline.tavily_mcp = SimpleNamespace(search=AsyncMock())
    pipeline.brave = SimpleNamespace(search=AsyncMock())

    result = await pipeline._discover_with_policy("run-1", 1, "query", "rationale", "web")

    assert result.result_ids == []
    assert result.provider == "tavily_api"
    pipeline.tavily_mcp.search.assert_not_awaited()


def test_planning_fallback_is_bounded_and_account_driven() -> None:
    plan = IntelligencePipeline._fallback_plan(
        AccountContext(name="Example Account"),
        "platform and security changes",
        "quarter",
    )

    assert len(plan.queries) == 3
    assert all("Example Account" in query for query in plan.queries)
    assert plan.coverage_limitations == [
        "MaaS planning was unavailable; deterministic query planning reduced research breadth."
    ]
