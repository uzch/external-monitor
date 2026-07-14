import { afterEach, describe, expect, it, vi } from "vitest";
import { intelligenceApi } from "../../src/services/intelligenceApi";

describe("intelligenceApi", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parses JSON bodies returned with HTTP 202", async () => {
    const run = {
      id: "run-1",
      state: "queued",
      account: { name: "Example", aliases: [] },
      timeframe: "quarter",
      created_at: "2026-07-14T00:00:00.000Z",
      updated_at: "2026-07-14T00:00:00.000Z",
      coverage_limitations: [],
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(run), {
        status: 202,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(intelligenceApi.startRun({
      account: { name: "Example", aliases: [] },
      timeframe: "quarter",
    })).resolves.toEqual(run);
  });

  it("replaces feedback with one versioned verdict", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({
        state: "current",
        current: {
          id: "feedback-2",
          revision: 2,
          verdict: "not_useful",
          reasons: ["weak_source"],
          explanation: "The source was too weak to validate the claim.",
          created_at: "2026-07-14T00:00:00.000Z",
        },
        history: [],
        legacy_tags: [],
      }), { status: 200, headers: { "Content-Type": "application/json" } }),
    );

    await intelligenceApi.feedback("run-1", "signal-1", {
      verdict: "not_useful",
      reasons: ["weak_source"],
      explanation: "The source was too weak to validate the claim.",
      expected_revision: 1,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/v2/research-runs/run-1/signals/signal-1/feedback",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          verdict: "not_useful",
          reasons: ["weak_source"],
          explanation: "The source was too weak to validate the claim.",
          expected_revision: 1,
        }),
      }),
    );
  });
});
