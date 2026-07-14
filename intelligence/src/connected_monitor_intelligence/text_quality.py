from typing import Any

_MOJIBAKE_MARKERS = ("\u00c2", "\u00c3", "\u00e2", "\u00f0")


def repair_mojibake(value: str) -> str:
    if not any(marker in value for marker in _MOJIBAKE_MARKERS):
        return value
    try:
        repaired = value.encode("latin-1").decode("utf-8")
    except (UnicodeEncodeError, UnicodeDecodeError):
        return value
    original_markers = sum(value.count(marker) for marker in _MOJIBAKE_MARKERS)
    repaired_markers = sum(repaired.count(marker) for marker in _MOJIBAKE_MARKERS)
    return repaired if repaired_markers < original_markers else value


def repair_text_tree(value: Any) -> Any:
    if isinstance(value, str):
        return repair_mojibake(value)
    if isinstance(value, list):
        return [repair_text_tree(item) for item in value]
    if isinstance(value, dict):
        return {key: repair_text_tree(item) for key, item in value.items()}
    return value
