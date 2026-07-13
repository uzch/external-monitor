import { retrievePublicEvidence } from "../publicRetrieval.js";

const urls = process.argv.slice(2);
if (urls.length === 0) {
  throw new Error("Provide one or more public URLs. Include an official page, news article, and PDF in the first probe set.");
}

const results = await Promise.all(urls.map(async (url) => {
  const startedAt = performance.now();
  try {
    const evidence = await retrievePublicEvidence(url, { timeoutMs: 15000, maxBytes: 5_000_000 });
    return {
      url,
      success: evidence.extractionMethod !== "unsupported" && evidence.text.length > 0,
      latencyMs: Math.round(performance.now() - startedAt),
      evidence: {
        canonicalUrl: evidence.canonicalUrl,
        contentType: evidence.contentType,
        extractionMethod: evidence.extractionMethod,
        publicationDate: evidence.publicationDate,
        publisher: evidence.publisher,
        textLength: evidence.text.length,
        title: evidence.title,
      },
      diagnostics: evidence.diagnostics,
    };
  } catch (error) {
    return {
      url,
      success: false,
      latencyMs: Math.round(performance.now() - startedAt),
      error: error instanceof Error ? error.message : String(error),
    };
  }
}));

process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
process.exitCode = results.every((result) => result.success) ? 0 : 1;
