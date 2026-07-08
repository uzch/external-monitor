import { describe, expect, it } from "vitest";
import { parseFeed } from "../../server/rssAtomConnector";

describe("RSS and Atom parsing", () => {
  it("extracts bounded RSS evidence", () => {
    const entries = parseFeed(
      `<?xml version="1.0"?>
      <rss><channel><item>
        <title>Example Corp announces platform modernization</title>
        <link>https://example.com/news/platform?utm_source=test</link>
        <pubDate>Mon, 06 Jul 2026 10:00:00 GMT</pubDate>
        <description><![CDATA[Example Corp announced a platform modernization program.]]></description>
      </item></channel></rss>`,
      "Example feed",
      "https://example.com/feed.xml",
    );

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      title: "Example Corp announces platform modernization",
      sourceName: "Example feed",
      excerpt: "Example Corp announced a platform modernization program.",
    });
    expect(entries[0].fingerprint).toHaveLength(64);
  });
});
