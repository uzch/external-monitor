from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from hashlib import sha256
from io import BytesIO
from urllib.parse import urlparse

import trafilatura
from pypdf import PdfReader

from .config import Settings
from .safety import safe_get


@dataclass(frozen=True)
class AcquiredDocument:
    canonical_url: str
    content_type: str
    body: bytes
    text: str
    title: str | None
    publisher: str
    publication_date: datetime | None
    retrieved_at: datetime
    extraction_method: str
    extraction_quality: float
    structure: dict
    diagnostics: list[str]

    @property
    def fingerprint(self) -> str:
        return sha256(f"{self.canonical_url}\n{self.text}".encode()).hexdigest()


class RetrievalRouter:
    def __init__(self, settings: Settings):
        self.settings = settings

    async def acquire(self, url: str, prefer_render: bool = False) -> AcquiredDocument:
        response, body, diagnostics = await safe_get(
            url,
            self.settings.retrieval_timeout_ms,
            self.settings.retrieval_max_bytes,
            {
                "Accept": "text/html,application/xhtml+xml,application/pdf;q=0.9,text/plain;q=0.8,*/*;q=0.1",
                "User-Agent": "ConnectedMonitorIntelligence/2.0",
            },
        )
        content_type = response.headers.get("content-type", "").split(";", 1)[0].lower()
        canonical_url = str(response.url)
        publisher = (
            urlparse(canonical_url).hostname.removeprefix("www.")
            if urlparse(canonical_url).hostname
            else "unknown"
        )
        retrieved_at = datetime.now(UTC)
        if content_type == "application/pdf" or canonical_url.lower().endswith(".pdf"):
            text, pages = self._extract_pdf(body)
            return AcquiredDocument(
                canonical_url,
                content_type or "application/pdf",
                body,
                text,
                None,
                publisher,
                None,
                retrieved_at,
                "pdf",
                self._quality(text),
                {"pages": pages},
                diagnostics,
            )
        if prefer_render:
            rendered = await self._render(canonical_url)
            if rendered:
                return AcquiredDocument(
                    canonical_url,
                    "text/html",
                    body,
                    rendered["text"],
                    rendered.get("title"),
                    publisher,
                    None,
                    retrieved_at,
                    "browser",
                    self._quality(rendered["text"]),
                    {"rendered": True},
                    diagnostics,
                )
        html = body.decode(response.encoding or "utf-8", errors="replace")
        extracted = (
            trafilatura.extract(html, include_comments=False, include_tables=True, output_format="txt") or ""
        )
        if len(extracted) < 300:
            rendered = await self._render(canonical_url)
            if rendered:
                return AcquiredDocument(
                    canonical_url,
                    content_type or "text/html",
                    body,
                    rendered["text"],
                    rendered.get("title"),
                    publisher,
                    None,
                    retrieved_at,
                    "browser",
                    self._quality(rendered["text"]),
                    {"rendered": True, "fallback": "low_direct_extraction"},
                    diagnostics,
                )
        title = trafilatura.extract_metadata(html).title if trafilatura.extract_metadata(html) else None
        return AcquiredDocument(
            canonical_url,
            content_type or "text/html",
            body,
            extracted,
            title,
            publisher,
            None,
            retrieved_at,
            "html",
            self._quality(extracted),
            {"rendered": False},
            diagnostics,
        )

    def _extract_pdf(self, body: bytes) -> tuple[str, list[dict]]:
        reader = PdfReader(BytesIO(body))
        pages = [
            {"page": index, "text": page.extract_text() or ""}
            for index, page in enumerate(reader.pages, start=1)
        ]
        return "\n".join(item["text"] for item in pages).strip(), pages

    async def _render(self, url: str) -> dict | None:
        from playwright.async_api import async_playwright

        try:
            async with async_playwright() as playwright:
                browser = await playwright.chromium.launch(headless=True)
                page = await browser.new_page()
                await page.goto(
                    url, wait_until="domcontentloaded", timeout=self.settings.retrieval_timeout_ms
                )
                text = (await page.locator("body").inner_text()).strip()
                title = await page.title()
                await browser.close()
            return {"text": text, "title": title} if text else None
        except Exception:
            return None

    @staticmethod
    def _quality(text: str) -> float:
        return min(1.0, len(text.strip()) / 3000) if text.strip() else 0.0
