from connected_monitor_intelligence.api import _evidence_preview
from connected_monitor_intelligence.text_quality import repair_mojibake, repair_text_tree


def test_repairs_utf8_text_decoded_as_latin1() -> None:
    assert repair_mojibake("Red Hat\u00e2\u0080\u0099s platform") == "Red Hat's platform".replace("'", "\u2019")


def test_repairs_nested_provider_output_without_changing_ascii() -> None:
    value = {"summary": "Red\u00c2\u00a0Hat", "items": ["plain ASCII"]}

    assert repair_text_tree(value) == {"summary": "Red\u00a0Hat", "items": ["plain ASCII"]}


def test_evidence_preview_anchors_on_distinctive_fact_language() -> None:
    text = "header " * 300 + "Dedicated cloud infrastructure supports the scanning system."

    preview = _evidence_preview(text, "The account established dedicated cloud infrastructure.")

    assert "Dedicated cloud infrastructure" in preview
    assert len(preview) <= 1206
