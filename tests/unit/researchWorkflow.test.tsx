import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { OptionalSemanticEvaluator } from "../../server/evaluator";
import { MonitorRunner } from "../../server/monitorRunner";
import { RawFeedEntry } from "../../server/rssAtomConnector";
import { SqliteConnectedRepositories } from "../../server/sqliteRepositories";
import { MonitoredAccount } from "../../src/domain/connectedContracts";
import { AccountSignalBriefDto, parseResearchImport, ResearchImportRequest } from "../../src/domain/researchContracts";
import { AccountDetailPage } from "../../src/ui/AccountDetailPage";
import { connectedApi } from "../../src/services/connectedApi";

vi.mock("../../src/services/connectedApi", () => ({
  connectedApi: {
    accountDetail: vi.fn(),
    accountSignalBrief: vi.fn(),
    researchCapabilities: vi.fn(),
    recordSignalFeedback: vi.fn(),
    updateSourceRegistration: vi.fn(),
  },
}));

const mockedApi = vi.mocked(connectedApi);
const defaultPolicy = {
  minIntervalMinutes: 0,
  timeoutMs: 1000,
  maxEntriesPerRun: 10,
  maxResponseBytes: 100000,
};

describe("research workflow", () => {
  it("validates and stores structured research imports as a separate research run", () => {
    const repositories = createRepositories();
    const account = repositories.accounts.createAccount({
      name: "Example Corp",
      aliases: ["Example"],
    });
    const importPayload = researchImport(account.id);

    const parsed = parseResearchImport(importPayload);
    const imported = repositories.research.importResearchRun(parsed);
    const brief = repositories.research.getLatestBrief(account.id);

    expect(imported.run.accountId).toBe(account.id);
    expect(imported.run.sourcePlan).toBe("Review public source categories likely to mention concrete external change.");
    expect(imported.run.sourcesChecked).toContain("Company newsroom");
    expect(imported.signals).toHaveLength(3);
    expect(brief?.topSignalsToValidate).toHaveLength(1);
    expect(brief?.watchItems).toHaveLength(1);
    expect(brief?.rejectedNoise).toHaveLength(1);
    expect(brief?.evidenceTable).toHaveLength(3);
  });

  it("rejects unsupported Red Hat intent, opportunity, demand, fit, deployment, renewal, or ownership claims", () => {
    const invalid = structuredClone(researchImport("acct-1"));
    invalid.executiveSummary = "This proves demand for Red Hat.";

    expect(() => parseResearchImport(invalid)).toThrow(/unsupported intent/);
  });

  it("does not reject source-backed external facts just because they mention deployment or renewal language", () => {
    const valid = structuredClone(researchImport("acct-1"));
    valid.signals[0] = {
      ...valid.signals[0],
      externalFact: "Example announced a deployment renewal program in a public source.",
    };

    expect(parseResearchImport(valid).signals[0].externalFact).toContain("deployment renewal");
  });

  it("allows bounded Red Hat hypotheses when evidence and uncertainty are preserved", () => {
    const valid = structuredClone(researchImport("acct-1"));
    valid.signals[0] = {
      ...valid.signals[0],
      redHatRelevanceHypothesis:
        "This may indicate a possible opportunity to validate platform operations needs; uncertainty remains medium.",
      uncertaintyState: "medium",
    };

    expect(parseResearchImport(valid).signals[0].redHatRelevanceHypothesis).toContain("may indicate");
  });

  it("stores and returns signals in stable sort order before priority tier", () => {
    const repositories = createRepositories();
    const account = repositories.accounts.createAccount({
      name: "Example Corp",
      aliases: ["Example"],
    });
    const input = structuredClone(researchImport(account.id));
    input.signals[0].externalFact = "Second ordered keep signal.";
    input.signals[0].sortOrder = 2;
    input.signals[0].priorityTier = "high";
    input.signals[1].disposition = "keep";
    input.signals[1].externalFact = "First ordered keep signal.";
    input.signals[1].sortOrder = 1;
    input.signals[1].priorityTier = "low";

    repositories.research.importResearchRun(parseResearchImport(input));
    const brief = repositories.research.getLatestBrief(account.id);

    expect(brief?.topSignalsToValidate.map((signal) => signal.externalFact)).toEqual([
      "First ordered keep signal.",
      "Second ordered keep signal.",
    ]);
  });

  it("returns append-only feedback after capture", () => {
    const repositories = createRepositories();
    const account = repositories.accounts.createAccount({
      name: "Example Corp",
      aliases: ["Example"],
    });
    const imported = repositories.research.importResearchRun(parseResearchImport(researchImport(account.id)));

    const saved = repositories.research.recordSignalFeedback(imported.signals[0].id, {
      feedbackType: "needs_better_source",
      notes: "Use an independent source next time.",
    });
    const brief = repositories.research.getLatestBrief(account.id);

    expect(saved?.feedbackType).toBe("needs_better_source");
    expect(brief?.feedbackSummary.needs_better_source).toBe(1);
    expect(brief?.feedback[0].notes).toBe("Use an independent source next time.");
  });

  it("displays process coverage, rejected noise, and feedback without promoting noise", async () => {
    const account = accountFixture();
    mockedApi.accountDetail.mockResolvedValue({
      account,
      sourceRegistrations: [],
      evaluatedSignals: [],
      awaitingEvaluation: [],
      abstainedSignals: [],
      degradedSignals: [],
      failedEvaluations: [],
      coverageNotice: "Coverage is bounded.",
    });
    mockedApi.accountSignalBrief.mockResolvedValue(briefFixture(account));
    mockedApi.researchCapabilities.mockResolvedValue({
      reasoning: { available: true, provider: "maas", message: "MaaS reasoning is ready." },
      retrieval: { available: true, provider: "application_controlled", message: "Retrieval is ready." },
      liveSearch: { available: false, message: "Live public-web search is not configured." },
    });

    render(
      <MemoryRouter initialEntries={["/accounts/acct-1"]}>
        <Routes>
          <Route path="/accounts/:accountId" element={<AccountDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByRole("heading", { name: "Account Signal Brief" })).toBeVisible());
    const topSignals = screen.getByRole("heading", { name: "Top signals to validate" }).closest("section");
    const rejectedNoise = screen.getByRole("heading", { name: "Rejected noise" }).closest("section");

    expect(screen.getByText("Review public source categories likely to mention concrete external change.")).toBeVisible();
    expect(screen.getByText("Company newsroom")).toBeVisible();
    expect(screen.getByText("Useful: 1")).toBeVisible();
    expect(screen.getByText("Account team already knew this signal.")).toBeVisible();
    expect(within(topSignals as HTMLElement).getByText("Example announced operations modernization.")).toBeVisible();
    expect(within(topSignals as HTMLElement).queryByText("Example posted a generic awards item.")).not.toBeInTheDocument();
    expect(within(rejectedNoise as HTMLElement).getAllByText("Example posted a generic awards item.").length)
      .toBeGreaterThan(0);
    expect(within(rejectedNoise as HTMLElement).getAllByText("No validation action recommended.").length)
      .toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Research readiness" })).toBeVisible();
    expect(screen.getByText("Live public-web search is not configured.")).toBeVisible();
  });

  it("separates degraded evaluator notices from monitor-run warnings", async () => {
    const repositories = createRepositories();
    const account = repositories.accounts.createAccount({
      name: "Example Corp",
      aliases: ["Example"],
    });
    repositories.accounts.createSourceRegistration({
      accountId: account.id,
      displayName: "Example feed",
      url: "https://example.com/feed.xml",
    });

    const runner = new MonitorRunner(
      repositories,
      new StubConnector([entry("Example Corp opens AI platform center")]),
      new OptionalSemanticEvaluator(),
    );

    const run = await runner.run();

    expect(run.state).toBe("completed");
    expect(run.warningCount).toBe(0);
    expect(run.errorCount).toBe(0);
    expect(run.diagnostics).toContain("Semantic evaluator is not configured; candidates remain awaiting evaluation.");
  });
});

function createRepositories() {
  return new SqliteConnectedRepositories(
    join(mkdtempSync(join(tmpdir(), "connected-monitor-")), "test.sqlite"),
    defaultPolicy,
  );
}

function researchImport(accountId: string): ResearchImportRequest {
  return {
    accountId,
    sourcePlan: "Review public source categories likely to mention concrete external change.",
    sourcesChecked: ["Company newsroom", "Investor relations"],
    sourceGaps: ["No independent trade coverage checked in this import."],
    searchQueriesUsed: ["Example operations modernization"],
    coverageLimitations: ["Manual GPT-assisted import only; no automated web search was run."],
    executiveSummary: "One public change may be worth validation. One item is watch-only and one was rejected as noise.",
    unknownsAndGuardrails: [
      "This brief does not claim customer intent, demand, deployment, renewal, ownership, or full external coverage.",
    ],
    signals: [
      {
        externalFact: "Example announced operations modernization.",
        sourceUrl: "https://example.com/news",
        publisher: "Example News",
        publicationDate: "2026-07-09T12:00:00.000Z",
        excerpt: "Example announced operations modernization in a public update.",
        accountMatchBasis: "Matched configured alias: Example",
        sourceCategory: "public_news",
        disposition: "keep",
        sortOrder: 0,
        priorityTier: "high",
        dispositionRationale: "The fact is specific and worth account-team validation.",
        redHatRelevanceHypothesis:
          "This may be worth validating for platform operations themes through a bounded Red Hat lens.",
        validationQuestion: "Does this public change affect platform operations priorities?",
        uncertaintyState: "medium",
      },
      {
        externalFact: "Example added a regional hiring post.",
        sourceUrl: "https://example.com/jobs",
        publisher: "Example Careers",
        publicationDate: "2026-07-08T12:00:00.000Z",
        excerpt: "Example added a regional hiring post.",
        accountMatchBasis: "Matched configured alias: Example",
        sourceCategory: "careers",
        disposition: "watch",
        sortOrder: 1,
        priorityTier: "low",
        dispositionRationale: "The item is weak but may become relevant if repeated.",
        redHatRelevanceHypothesis:
          "This might be worth watching as a weak operations-capacity signal, with high uncertainty.",
        validationQuestion: "Has the account team heard about a related operations initiative?",
        uncertaintyState: "high",
      },
      {
        externalFact: "Example posted a generic awards item.",
        sourceUrl: "https://example.com/awards",
        publisher: "Example Blog",
        publicationDate: "2026-07-07T12:00:00.000Z",
        excerpt: "Example posted a generic awards item.",
        accountMatchBasis: "Matched configured alias: Example",
        sourceCategory: "company_blog",
        disposition: "reject",
        sortOrder: 2,
        priorityTier: "none",
        dispositionRationale: "The item does not identify a concrete external change to validate.",
        uncertaintyState: "low",
      },
    ],
  };
}

function accountFixture(): MonitoredAccount {
  return {
    id: "acct-1",
    name: "Example Corp",
    aliases: ["Example"],
    hierarchyNodeId: "local",
    hierarchyLabel: "Local monitored accounts",
    hierarchyPath: ["Local monitored accounts"],
    mappingStatus: "partial_validated",
    status: "active",
    createdAt: "2026-07-09T12:00:00.000Z",
    updatedAt: "2026-07-09T12:00:00.000Z",
  };
}

function briefFixture(account: ReturnType<typeof accountFixture>): AccountSignalBriefDto {
  const run: AccountSignalBriefDto["latestResearchRun"] = {
    id: "research-run-1",
    accountId: account.id,
    state: "imported",
    importSource: "gpt_assisted",
    executiveSummary: "One signal to validate and one rejected noise item.",
    sourcePlan: "Review public source categories likely to mention concrete external change.",
    sourcesChecked: ["Company newsroom", "Investor relations"],
    sourceGaps: ["No independent trade coverage checked in this import."],
    searchQueriesUsed: ["Example operations modernization"],
    coverageLimitations: ["Manual GPT-assisted import only; no automated web search was run."],
    unknownsAndGuardrails: ["Do not infer account intent."],
    createdAt: "2026-07-09T12:00:00.000Z",
    updatedAt: "2026-07-09T12:00:00.000Z",
    importedAt: "2026-07-09T12:00:00.000Z",
  };
  const signals = parseResearchImport(researchImport(account.id)).signals.map((signal, index) => ({
    ...signal,
    id: `signal-${index}`,
    researchRunId: run.id,
    accountId: account.id,
    retrievedAt: signal.retrievedAt ?? "2026-07-09T12:00:00.000Z",
    sortOrder: signal.sortOrder ?? index,
    priorityTier: signal.priorityTier ?? "none",
    createdAt: "2026-07-09T12:00:00.000Z",
  }));
  const feedback = [
    {
      id: "feedback-1",
      researchSignalId: signals[0].id,
      feedbackType: "useful",
      notes: "Account team already knew this signal.",
      createdAt: "2026-07-09T13:00:00.000Z",
    },
  ] as const;

  return {
    account,
    latestResearchRun: run,
    executiveSummary: run.executiveSummary,
    topSignalsToValidate: signals.filter((signal) => signal.disposition === "keep"),
    watchItems: signals.filter((signal) => signal.disposition === "watch"),
    rejectedNoise: signals.filter((signal) => signal.disposition === "reject"),
    abstainedSignals: [],
    evidenceTable: signals,
    validationQuestions: signals
      .filter((signal) => signal.disposition === "keep" || signal.disposition === "watch")
      .map((signal) => signal.validationQuestion)
      .filter((question): question is string => Boolean(question)),
    unknownsAndGuardrails: run.unknownsAndGuardrails,
    feedbackSummary: {
      useful: 1,
      not_useful: 0,
      wrong_angle: 0,
      already_known: 0,
      needs_better_source: 0,
      follow_up_later: 0,
    },
    feedback: [...feedback],
  };
}

class StubConnector {
  constructor(private readonly entries: RawFeedEntry[]) {}

  async retrieve() {
    return {
      entries: this.entries,
      diagnostics: ["stub connector"],
      finalUrl: "https://example.com/feed.xml",
    };
  }
}

function entry(title: string): RawFeedEntry {
  return {
    title,
    link: "https://example.com/news",
    publicationDate: "2026-07-06T10:00:00.000Z",
    excerpt: `${title}. This is bounded public source evidence.`,
    sourceName: "Example feed",
    fingerprint: "a".repeat(64),
  };
}
