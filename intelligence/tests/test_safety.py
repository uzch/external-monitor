from connected_monitor_intelligence.safety import _is_public


def test_private_and_public_address_policy() -> None:
    assert not _is_public("127.0.0.1")
    assert not _is_public("10.0.0.1")
    assert _is_public("1.1.1.1")
