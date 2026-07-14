from __future__ import annotations

import ipaddress
import socket
from urllib.parse import urljoin, urlparse

import httpx


class RetrievalSafetyError(ValueError):
    pass


async def validate_public_url(url: str) -> None:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname or parsed.username or parsed.password:
        raise RetrievalSafetyError("Only credential-free public HTTP(S) URLs are allowed")
    if parsed.hostname.lower() == "localhost" or parsed.hostname.lower().endswith(".localhost"):
        raise RetrievalSafetyError("Localhost is not a public source")
    try:
        addresses = await _resolve(parsed.hostname)
    except socket.gaierror as error:
        raise RetrievalSafetyError("Source hostname did not resolve") from error
    if not addresses or any(not _is_public(address) for address in addresses):
        raise RetrievalSafetyError("Source resolves to a non-public address")


async def safe_get(
    url: str, timeout_ms: int, max_bytes: int, headers: dict[str, str]
) -> tuple[httpx.Response, bytes, list[str]]:
    current = url
    diagnostics: list[str] = []
    for _ in range(4):
        await validate_public_url(current)
        async with httpx.AsyncClient(follow_redirects=False, timeout=timeout_ms / 1000) as client:
            response = await client.get(current, headers=headers)
        if response.status_code in {301, 302, 303, 307, 308}:
            location = response.headers.get("location")
            if not location:
                raise RetrievalSafetyError("Redirect did not provide a location")
            current = urljoin(current, location)
            diagnostics.append(f"followed redirect to {urlparse(current).hostname}")
            continue
        response.raise_for_status()
        body = response.content
        if len(body) > max_bytes:
            raise RetrievalSafetyError("Source response exceeded configured byte limit")
        return response, body, diagnostics
    raise RetrievalSafetyError("Source exceeded redirect limit")


async def _resolve(hostname: str) -> list[str]:
    loop = __import__("asyncio").get_running_loop()
    infos = await loop.getaddrinfo(hostname, None, type=socket.SOCK_STREAM)
    return list({info[4][0] for info in infos})


def _is_public(address: str) -> bool:
    value = ipaddress.ip_address(address)
    return not any(
        (
            value.is_private,
            value.is_loopback,
            value.is_link_local,
            value.is_multicast,
            value.is_reserved,
            value.is_unspecified,
        )
    )
