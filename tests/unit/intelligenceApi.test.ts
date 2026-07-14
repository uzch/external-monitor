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
});
