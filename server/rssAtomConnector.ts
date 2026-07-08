import { createHash } from "node:crypto";
import { SourceRegistration } from "../src/domain/connectedContracts.js";
import { fetchSafeText } from "./sourceSafety.js";

export interface RawFeedEntry {
  title: string;
  link: string;
  publicationDate: string;
  excerpt: string;
  sourceName: string;
  fingerprint: string;
}

export interface PublicSourceConnector {
  retrieve(source: SourceRegistration): Promise<{
    entries: RawFeedEntry[];
    diagnostics: string[];
    finalUrl: string;
  }>;
}

export class RssAtomConnector implements PublicSourceConnector {
  async retrieve(source: SourceRegistration) {
    const { body, finalUrl, diagnostics } = await fetchSafeText(
      source.url,
      source.policy.timeoutMs,
      source.policy.maxResponseBytes,
    );
    const entries = parseFeed(body, source.displayName, finalUrl)
      .slice(0, source.policy.maxEntriesPerRun);
    return { entries, diagnostics, finalUrl };
  }
}

export function parseFeed(xml: string, sourceName: string, fallbackUrl: string): RawFeedEntry[] {
  const rssItems = extractBlocks(xml, "item");
  if (rssItems.length > 0) {
    return rssItems.map((item) => entryFromRssItem(item, sourceName, fallbackUrl)).filter(isComplete);
  }

  return extractBlocks(xml, "entry")
    .map((entry) => entryFromAtomEntry(entry, sourceName, fallbackUrl))
    .filter(isComplete);
}

function entryFromRssItem(item: string, sourceName: string, fallbackUrl: string): RawFeedEntry {
  const title = cleanText(tagText(item, "title"));
  const link = cleanText(tagText(item, "link")) || fallbackUrl;
  const publicationDate = parseDate(
    tagText(item, "pubDate") || tagText(item, "published") || tagText(item, "updated"),
  );
  const excerpt = cleanText(
    tagText(item, "description") || tagText(item, "content:encoded") || tagText(item, "summary"),
  );
  return makeEntry({ title, link, publicationDate, excerpt, sourceName });
}

function entryFromAtomEntry(entry: string, sourceName: string, fallbackUrl: string): RawFeedEntry {
  const title = cleanText(tagText(entry, "title"));
  const link = atomLink(entry) || fallbackUrl;
  const publicationDate = parseDate(tagText(entry, "published") || tagText(entry, "updated"));
  const excerpt = cleanText(tagText(entry, "summary") || tagText(entry, "content"));
  return makeEntry({ title, link, publicationDate, excerpt, sourceName });
}

function makeEntry(input: Omit<RawFeedEntry, "fingerprint">): RawFeedEntry {
  const excerpt = truncate(input.excerpt || input.title, 1200);
  const fingerprint = createHash("sha256")
    .update(`${input.title}\n${input.link}\n${input.publicationDate}\n${excerpt}`)
    .digest("hex");
  return { ...input, excerpt, fingerprint };
}

function extractBlocks(xml: string, tagName: string): string[] {
  const escaped = tagName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, "gi");
  const blocks: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml))) {
    blocks.push(match[1]);
  }
  return blocks;
}

function tagText(xml: string, tagName: string): string {
  const escaped = tagName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, "i");
  const match = re.exec(xml);
  return match?.[1] ?? "";
}

function atomLink(xml: string): string {
  const re = /<link\b([^>]*)>/gi;
  let fallback = "";
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml))) {
    const attrs = match[1];
    const href = attr(attrs, "href");
    if (!href) {
      continue;
    }
    fallback ||= href;
    const rel = attr(attrs, "rel");
    if (!rel || rel === "alternate") {
      return href;
    }
  }
  return fallback;
}

function attr(attrs: string, name: string): string {
  const re = new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i");
  return decodeEntities(re.exec(attrs)?.[1] ?? "");
}

function cleanText(value: string): string {
  return truncate(
    decodeEntities(value)
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
    2000,
  );
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}

function parseDate(value: string): string {
  const timestamp = Date.parse(cleanText(value));
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : new Date().toISOString();
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 3)}...` : value;
}

function isComplete(entry: RawFeedEntry): boolean {
  return Boolean(entry.title && entry.link && entry.publicationDate && entry.excerpt);
}
