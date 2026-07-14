import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AutonomousResearchPage } from "../../src/ui/AutonomousResearchPage";
import { intelligenceApi } from "../../src/services/intelligenceApi";

vi.mock("../../src/services/intelligenceApi", () => ({
  intelligenceApi: {
    run: vi.fn(),
    brief: vi.fn(),
    startRun: vi.fn(),
    feedback: vi.fn(),
    cancel: vi.fn(),
  },
}));

const mockedApi = vi.mocked(intelligenceApi);
const storage = new Map<string, string>();

describe("AutonomousResearchPage", () => {
  beforeEach(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        clear: () => storage.clear(),
        getItem: (key: string) => storage.get(key) ?? null,
        removeItem: (key: string) => storage.delete(key),
        setItem: (key: string, value: string) => storage.set(key, value),
      },
    });
    window.localStorage.clear();
    window.history.replaceState({}, "", "/research");
    mockedApi.run.mockReset();
    mockedApi.brief.mockReset();
    mockedApi.startRun.mockReset();
  });

  it("recovers the active research run after refresh", async () => {
    window.localStorage.setItem("connected-monitor.activeResearchRunId", "run-1");
    mockedApi.run.mockResolvedValue({
      id: "run-1",
      state: "planning",
      account: { name: "Example", aliases: [] },
      timeframe: "quarter",
      created_at: "2026-07-14T00:00:00.000Z",
      updated_at: "2026-07-14T00:00:00.000Z",
      coverage_limitations: [],
    });

    render(<AutonomousResearchPage />);

    await waitFor(() => expect(mockedApi.run).toHaveBeenCalledWith("run-1"));
    expect(screen.getByRole("heading", { name: "planning" })).toBeVisible();
  });

  it("clears an invalid saved research run ID", async () => {
    window.localStorage.setItem("connected-monitor.activeResearchRunId", "missing-run");
    mockedApi.run.mockRejectedValue(new Error("Research run not found"));

    render(<AutonomousResearchPage />);

    await waitFor(() => expect(window.localStorage.getItem("connected-monitor.activeResearchRunId")).toBeNull());
  });

  it("opens a persisted run from a shareable local query parameter", async () => {
    window.history.replaceState({}, "", "/research?runId=demo-run");
    mockedApi.run.mockResolvedValue({
      id: "demo-run",
      state: "completed",
      account: { name: "Example", aliases: [] },
      timeframe: "quarter",
      created_at: "2026-07-14T00:00:00.000Z",
      updated_at: "2026-07-14T00:00:00.000Z",
      coverage_limitations: [],
    });
    mockedApi.brief.mockResolvedValue({
      run: await mockedApi.run("demo-run"),
      top_signals: [],
      watch_items: [],
      rejected_items: [],
      abstained_items: [],
      unknowns_and_guardrails: [],
    });

    render(<AutonomousResearchPage />);

    await waitFor(() => expect(mockedApi.run).toHaveBeenCalledWith("demo-run"));
    expect(window.localStorage.getItem("connected-monitor.activeResearchRunId")).toBe("demo-run");
  });

  it("replaces the saved research run ID when a new run starts", async () => {
    window.localStorage.setItem("connected-monitor.activeResearchRunId", "old-run");
    mockedApi.run.mockResolvedValue({
      id: "old-run",
      state: "planning",
      account: { name: "Old", aliases: [] },
      timeframe: "quarter",
      created_at: "2026-07-14T00:00:00.000Z",
      updated_at: "2026-07-14T00:00:00.000Z",
      coverage_limitations: [],
    });
    mockedApi.startRun.mockResolvedValue({
      id: "new-run",
      state: "queued",
      account: { name: "Example", aliases: [] },
      timeframe: "quarter",
      created_at: "2026-07-14T00:00:00.000Z",
      updated_at: "2026-07-14T00:00:00.000Z",
      coverage_limitations: [],
    });

    render(<AutonomousResearchPage />);
    await userEvent.type(screen.getByLabelText("Account name"), "Example");
    await userEvent.click(screen.getByRole("button", { name: "Start research" }));

    await waitFor(() => expect(window.localStorage.getItem("connected-monitor.activeResearchRunId")).toBe("new-run"));
  });
});
