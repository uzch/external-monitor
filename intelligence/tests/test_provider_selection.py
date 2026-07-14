from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import httpx
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


@pytest.mark.asyncio
async def test_failed_ranking_is_retained_as_an_abstained_candidate() -> None:
    pipeline = object.__new__(IntelligencePipeline)
    pipeline.store = SimpleNamespace(
        start_task=Mock(return_value="task-1"),
        list_claims=Mock(return_value=[SimpleNamespace(id="claim-1", external_fact="Bounded fact")]),
        evidence_for_claim=Mock(return_value=[(
            SimpleNamespace(id="evidence-1", canonical_url="https://example.test/source", publisher="Example"),
            SimpleNamespace(text="Bounded supporting evidence"),
        )]),
        record_verification=Mock(return_value=SimpleNamespace(id="verification-1")),
        record_signal=Mock(return_value=SimpleNamespace(id="signal-1")),
        signal_for_claim=Mock(return_value=None),
        fail_task=Mock(),
    )
    pipeline.maas = SimpleNamespace(complete=AsyncMock(side_effect=RuntimeError("structured output unavailable")))
    pipeline._run = Mock(return_value=SimpleNamespace(policy_version="baseline-v1"))

    signal_id = await pipeline.verify_and_rank("run-1", "claim-1", 1)

    assert signal_id == "signal-1"
    assessment = pipeline.store.record_signal.call_args.args[3]
    assert assessment.disposition == "abstain"
    assert assessment.priority_tier == "none"


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


def test_provider_error_diagnostics_never_include_authenticated_urls() -> None:
    request = httpx.Request("GET", "https://example.test/mcp?token=sensitive")
    error = httpx.ConnectError("connection failed", request=request)

    diagnostic = IntelligencePipeline._safe_provider_error(error)

    assert diagnostic == "Provider request failed with ConnectError."
    assert "token" not in diagnostic
    assert "example.test" not in diagnostic
