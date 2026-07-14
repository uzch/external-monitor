import pytest

from connected_monitor_intelligence.contracts import FactExtraction
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


def test_maas_extracts_fenced_json_content() -> None:
    payload = {
        "choices": [
            {
                "message": {
                    "content": '```json\n{"facts": []}\n```',
                }
            }
        ]
    }

    assert MaaSClient._extract_json(payload) == {"facts": []}


def test_maas_normalizes_observed_fact_wire_shape_before_strict_validation() -> None:
    wire_output = {
        "facts": [
            {
                "fact": "The account published a platform update.",
                "excerpt": "The account published a platform update.",
            },
            "unsupported free-form fact",
        ]
    }

    normalized = MaaSClient._normalize_wire_output(FactExtraction, wire_output)
    parsed = FactExtraction.model_validate(normalized)

    assert len(parsed.facts) == 1
    assert parsed.facts[0].external_fact == "The account published a platform update."
    assert parsed.facts[0].supporting_excerpt == "The account published a platform update."


def test_maas_fact_normalization_caps_output_to_three_facts() -> None:
    wire_output = {
        "facts": [
            {"fact": f"Fact {index}", "excerpt": f"Fact {index}", "uncertainty": "Bounded"}
            for index in range(6)
        ]
    }

    normalized = MaaSClient._normalize_wire_output(FactExtraction, wire_output)

    assert len(normalized["facts"]) == 3
