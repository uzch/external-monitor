import { createHash } from "node:crypto";
import { fetchSafeResponse } from "./sourceSafety.js";

export interface RetrievedPublicEvidence {
  canonicalUrl: string;
  contentFingerprint: string;
  contentType: string;
  excerpt: string;
  extractionMethod: "html" | "pdf" | "unsupported";
  publicationDate?: string;
  publisher: string;
  retrievedAt: string;
  text: string;
  title?: string;
  diagnostics: string[];
}

export interface PublicRetrievalOptions {
  timeoutMs: number;
  maxBytes: number;
}

export async function retrievePublicEvidence(
  url: string,
  options: PublicRetrievalOptions,
): Promise<RetrievedPublicEvidence> {
  const result = await fetchSafeResponse(url, options.timeoutMs, options.maxBytes, {
    Accept: "text/html,application/xhtml+xml,application/pdf;q=0.9,text/plain;q=0.8,*/*;q=0.1",
  });
  const retrievedAt = new Date().toISOString();
  const normalizedContentType = result.contentType.toLowerCase().split(";", 1)[0];
  const publisher = new URL(result.finalUrl).hostname.replace(/^www\./, "");

  if (normalizedContentType === "application/pdf" || result.finalUrl.toLowerCase().endsWith(".pdf")) {
    const text = await extractPdfText(result.body);
    return evidenceResult({
      canonicalUrl: result.finalUrl,
      contentType: normalizedContentType || "application/pdf",
      diagnostics: result.diagnostics,
      extractionMethod: "pdf",
      publisher,
      retrievedAt,
      text,
      title: filenameTitle(result.finalUrl),
    });
  }

  if (normalizedContentType.includes("html") || normalizedContentType.startsWith("text/")) {
    const html = new TextDecoder().decode(result.body);
    return evidenceResult({
      canonicalUrl: result.finalUrl,
      contentType: normalizedContentType || "text/html",
      diagnostics: result.diagnostics,
      extractionMethod: "html",
      publisher,
      retrievedAt,
      ...extractHtmlEvidence(html),
    });
  }

  return evidenceResult({
    canonicalUrl: result.finalUrl,
    contentType: normalizedContentType || "unknown",
    diagnostics: [...result.diagnostics, "Unsupported content type for extraction."],
    extractionMethod: "unsupported",
    publisher,
    retrievedAt,
    text: "",
  });
}

export function extractHtmlEvidence(html: string): { title?: string; publicationDate?: string; text: string } {
  const title = decodeHtml(matchTag(html, "title"));
  const publicationDate = findMetaDate(html);
  const article = matchTag(html, "article") || matchTag(html, "main") || matchTag(html, "body") || html;
  const text = cleanText(article)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 20000);
  return {
    title: title || undefined,
    publicationDate,
    text,
  };
}

function evidenceResult(input: Omit<RetrievedPublicEvidence, "contentFingerprint" | "excerpt">): RetrievedPublicEvidence {
  const excerpt = input.text.slice(0, 1200).trim();
  return {
    ...input,
    excerpt,
    contentFingerprint: createHash("sha256")
      .update(`${input.canonicalUrl}\n${input.text}`)
      .digest("hex"),
  };
}

async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const document = await getDocument({ data: bytes }).promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const content = await (await document.getPage(pageNumber)).getTextContent();
    pages.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
  }
  return pages.join("\n").replace(/\s+/g, " ").trim().slice(0, 20000);
}

function matchTag(html: string, tag: string): string {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)</${escaped}>`, "i").exec(html)?.[1] ?? "";
}

function findMetaDate(html: string): string | undefined {
  const matches = [...html.matchAll(/<meta\s+[^>]*(?:name|property)=["'](?:article:published_time|date|datepublished|publishdate)["'][^>]*>/gi)];
  for (const match of matches) {
    const content = /content=["']([^"']+)["']/i.exec(match[0])?.[1];
    if (content && Number.isFinite(Date.parse(content))) {
      return new Date(content).toISOString();
    }
  }
  return undefined;
}

function cleanText(value: string): string {
  return decodeHtml(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
}

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'");
}

function filenameTitle(url: string): string | undefined {
  const name = new URL(url).pathname.split("/").pop();
  return name ? decodeURIComponent(name).replace(/\.pdf$/i, "").replace(/[-_]/g, " ") : undefined;
}
