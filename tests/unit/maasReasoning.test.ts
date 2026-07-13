import { afterEach, describe, expect, it, vi } from "vitest";
import { MaaSReasoningProvider, maasBenchmarkModels } from "../../server/maasReasoning";

describe("MaaS reasoning probe", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports missing configuration without attempting a model call", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await new MaaSReasoningProvider({ timeoutMs: 1000 }).probe();

    expect(result.success).toBe(false);
    expect(result.tests[0].id).toBe("configuration");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("validates structured planning, extraction, evaluation, and verification responses", async () => {
    const responses = [
      { sourcePlan: "Review official and independent public sources.", queries: ["Example Industries modernization"], coverageLimitations: [] },
      { externalFact: "Example Industries announced a consolidation.", excerpt: "announced a consolidation", publicationDate: "2026-07-01", uncertainty: "low" },
      { disposition: "keep", rationale: "The fact is concrete.", relevanceHypothesis: "This may be worth validating through a bounded Red Hat lens.", validationQuestion: "Does this change affect platform operations priorities?", uncertainty: "medium" },
      { state: "supported", rationale: "The claim matches evidence-1.", citedEvidenceIds: ["evidence-1"] },
    ];
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify(responses.shift()) } }],
      }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await new MaaSReasoningProvider({
      baseUrl: "https://maas.example.test/llm/example/v1",
      apiKey: "test-key",
      model: "example-model",
      timeoutMs: 1000,
    }).probe();

    expect(result.success).toBe(true);
    expect(result.tests).toHaveLength(4);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://maas.example.test/llm/example/v1/chat/completions");
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({ Authorization: "Bearer test-key" });
  });

  it("keeps the authorized benchmark models in the required order", () => {
    expect(maasBenchmarkModels.map((model) => model.id)).toEqual([
      "gpt-oss-120b",
      "deepseek-r1-distill-qwen-14b",
      "llama-scout-17b",
      "gpt-oss-20b",
    ]);
  });

  it("accepts legacy OpenAI-compatible function-call arguments", async () => {
    const responses = [
      { sourcePlan: "Review official sources.", queries: ["Example Industries"], coverageLimitations: [] },
      { externalFact: "Example announced a consolidation.", excerpt: "announced a consolidation", publicationDate: "2026-07-01", uncertainty: "low" },
      { disposition: "keep", rationale: "The evidence is concrete.", validationQuestion: "What should be validated?", uncertainty: "medium" },
      { state: "supported", rationale: "The claim matches evidence-1.", citedEvidenceIds: ["evidence-1"] },
    ];
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => new Response(JSON.stringify({
        choices: [{ message: { function_call: { arguments: JSON.stringify(responses.shift()) } } }],
      }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await new MaaSReasoningProvider({
      baseUrl: "https://maas.example.test/llm/example/v1",
      apiKey: "test-key",
      model: "gpt-oss-120b",
      timeoutMs: 1000,
    }).probe();

    expect(result.success).toBe(true);
    expect(fetchMock.mock.calls[0][1]?.body).toContain("tool_choice");
  });
});
