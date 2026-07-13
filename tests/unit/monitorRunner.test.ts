import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EvaluationRecord } from "../../src/domain/connectedContracts";
import { OptionalSemanticEvaluator, SemanticEvaluator, evaluationPolicyVersion } from "../../server/evaluator";
import { MonitorRunner } from "../../server/monitorRunner";
import { RawFeedEntry } from "../../server/rssAtomConnector";
import { SqliteConnectedRepositories } from "../../server/sqliteRepositories";

const defaultPolicy = {
  minIntervalMinutes: 0,
  timeoutMs: 1000,
  maxEntriesPerRun: 10,
  maxResponseBytes: 100000,
};

describe("monitor runner", () => {
  it("stores real candidates as awaiting evaluation when no evaluator is configured", async () => {
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
    const detail = repositories.rankings.getAccountDetail(account.id);

    expect(run.state).toBe("completed");
    expect(detail?.awaitingEvaluation).toHaveLength(1);
    expect(detail?.evaluatedSignals).toHaveLength(0);
    expect(repositories.rankings.latestAccountSummaries()[0].rankingScore).toBe(0);
  });

  it("ranks only evidence-backed evaluated semantic records", async () => {
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
      new StubConnector([entry("Example Corp expands automation platform")]),
      new StubEvaluator(),
    );

    await runner.run();
    const detail = repositories.rankings.getAccountDetail(account.id);
    const summary = repositories.rankings.latestAccountSummaries()[0];

    expect(detail?.evaluatedSignals).toHaveLength(1);
    expect(detail?.awaitingEvaluation).toHaveLength(0);
    expect(summary.rankingScore).toBe(72);
  });
});
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

class StubEvaluator implements SemanticEvaluator {
  isConfigured() {
    return true;
  }

  async evaluate(candidate: { id: string; runId: string; accountId: string; accountMatchBasis: string }): Promise<EvaluationRecord> {
    return {
      id: "eval-1",
      candidateId: candidate.id,
      runId: candidate.runId,
      accountId: candidate.accountId,
      state: "evaluated",
      evaluatorName: "stub",
      evaluatorVersion: "1",
      evaluationPolicyVersion,
      accountMatchBasis: candidate.accountMatchBasis,
      externalFact: "Example Corp expanded an automation platform.",
      evidenceReference: "https://example.com/news",
      selectedCapabilityIds: ["automation"],
      relevanceHypothesis: "The public event may be worth validating for automation operations themes.",
      uncertainty: "Medium",
      validationAction: "Validate whether the announcement affects platform operations priorities.",
      factorScores: { evidenceStrength: 8, relevanceStrength: 7 },
      semanticPriorityScore: 72,
      evaluatedAt: new Date().toISOString(),
    };
  }
}

function createRepositories() {
  return new SqliteConnectedRepositories(
    join(mkdtempSync(join(tmpdir(), "connected-monitor-")), "test.sqlite"),
    defaultPolicy,
  );
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
