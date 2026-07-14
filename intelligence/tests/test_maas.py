import pytest

from connected_monitor_intelligence.maas import MaaSClient, MaaSError


def test_maas_extracts_legacy_tool_call_arguments() -> None:
    payload = {
        "choices": [
            {
                "message": {
                    "tool_calls": [
                        {
                            "function": {
                                "arguments": '{"source_plan":"Plan","queries":["query"],"coverage_limitations":[],"unresolved_questions":[]}'
                            }
                        }
                    ]
                }
            }
        ]
    }
    assert MaaSClient._extract_json(payload)["source_plan"] == "Plan"


def test_maas_rejects_missing_structured_content() -> None:
    with pytest.raises(MaaSError):
        MaaSClient._extract_json({"choices": [{"message": {}}]})
