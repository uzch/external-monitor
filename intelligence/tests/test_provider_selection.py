from connected_monitor_intelligence.config import Settings
from connected_monitor_intelligence.pipeline import IntelligencePipeline


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
