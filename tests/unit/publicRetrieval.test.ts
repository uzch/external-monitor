import { describe, expect, it } from "vitest";
import { extractHtmlEvidence } from "../../server/publicRetrieval";

describe("public evidence extraction", () => {
  it("extracts readable text, title, and publication date from ordinary public HTML", () => {
    const evidence = extractHtmlEvidence(`
      <html><head>
        <title>Example update</title>
        <meta property="article:published_time" content="2026-07-10T09:30:00Z">
      </head><body><main><script>ignore()</script>
        <p>Example Industries announced an operations update.</p>
      </main></body></html>
    `);

    expect(evidence.title).toBe("Example update");
    expect(evidence.publicationDate).toBe("2026-07-10T09:30:00.000Z");
    expect(evidence.text).toContain("Example Industries announced an operations update.");
    expect(evidence.text).not.toContain("ignore()");
  });
});
