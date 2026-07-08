import { createHash, randomUUID } from "node:crypto";
import {
  CandidateEventRecord,
  MonitorRun,
  MonitoredAccount,
  RankingSnapshot,
  SourceDiagnostics,
  SourceRegistration,
} from "../src/domain/connectedContracts.js";
import { ConnectedRepositories } from "./repositories.js";
import { PublicSourceConnector, RawFeedEntry } from "./rssAtomConnector.js";
import { SemanticEvaluator } from "./evaluator.js";

export class MonitorRunner {
  constructor(
    private readonly repositories: ConnectedRepositories,
    private readonly connector: PublicSourceConnector,
    private readonly evaluator: SemanticEvaluator,
  ) {}

  async run(requestedAccountId?: string): Promise<MonitorRun> {
    let run = this.repositories.runs.createRun(requestedAccountId);

    const update = (state: MonitorRun["state"], diagnostic?: string) => {
      run = {
        ...run,
        state,
        startedAt: run.startedAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        diagnostics: diagnostic ? [...run.diagnostics, diagnostic] : run.diagnostics,
      };
      this.repositories.runs.updateRun(run);
    };

    try {
      update("running");
      const accounts = this.repositories.accounts
        .listAccounts()
        .filter((account) => account.status === "active")
        .filter((account) => !requestedAccountId || account.id === requestedAccountId);
      const accountById = new Map(accounts.map((account) => [account.id, account]));

      update("retrieving");
      for (const account of accounts) {
        const sources = this.repositories.accounts
          .listSourceRegistrations(account.id)
          .filter((source) => source.state === "active");
        for (const source of sources) {
          const hadWarning = await this.retrieveSource(run.id, account, source);
          if (hadWarning) {
            run = { ...run, warningCount: run.warningCount + 1 };
            this.repositories.runs.updateRun(run);
          }
        }
      }

      update("deduplicating");
      this.markDuplicates(run.id);

      const candidates = this.repositories.candidates.listCandidatesForRun(run.id);
      const evaluableCandidates = candidates.filter(
        (candidate) => candidate.prefilterStatus === "matched" && !candidate.isDuplicate,
      );

      if (!this.evaluator.isConfigured()) {
        update("awaiting_evaluation", "Semantic evaluator is not configured; candidates remain awaiting evaluation.");
      } else {
        update("evaluating");
        for (const candidate of evaluableCandidates) {
          const account = accountById.get(candidate.accountId);
          if (!account) {
            continue;
          }
          const evaluation = await this.evaluator.evaluate(candidate, account);
          this.repositories.evaluations.insertEvaluation(evaluation);
          if (evaluation.state === "failed") {
            run = { ...run, errorCount: run.errorCount + 1 };
            this.repositories.runs.updateRun(run);
          }
        }
      }

      update("ranking");
      this.repositories.rankings.replaceRankingSnapshots(
        run.id,
        this.buildRankingSnapshots(run.id, accounts),
      );

      const hasWarnings = run.warningCount > 0 || run.diagnostics.length > 0;
      run = {
        ...run,
        state: run.errorCount > 0 || hasWarnings ? "completed_with_warnings" : "completed",
        finishedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.repositories.runs.updateRun(run);
      return run;
    } catch (error) {
      run = {
        ...run,
        state: "failed",
        errorCount: run.errorCount + 1,
        diagnostics: [...run.diagnostics, error instanceof Error ? error.message : String(error)],
        finishedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.repositories.runs.updateRun(run);
      return run;
    }
  }

  private async retrieveSource(
    runId: string,
    account: MonitoredAccount,
    source: SourceRegistration,
  ): Promise<boolean> {
    const startedAt = new Date().toISOString();
    const throttled = source.lastRetrievedAt
      ? Date.now() - Date.parse(source.lastRetrievedAt) < source.policy.minIntervalMinutes * 60_000
      : false;

    if (throttled) {
      this.repositories.runs.addSourceDiagnostics(runId, {
        sourceRegistrationId: source.id,
        status: "skipped",
        startedAt,
        finishedAt: new Date().toISOString(),
        message: "Skipped due to per-source throttling policy.",
        retrievedEntryCount: 0,
        acceptedEntryCount: 0,
      });
      return true;
    }

    try {
      const result = await this.connector.retrieve(source);
      let accepted = 0;
      for (const entry of result.entries) {
        const candidate = buildCandidate(runId, account, source, entry);
        this.repositories.candidates.insertCandidate(candidate);
        if (candidate.prefilterStatus === "matched") {
          accepted += 1;
        }
      }
      const retrievedAt = new Date().toISOString();
      this.repositories.accounts.markSourceRetrieved(source.id, retrievedAt);
      this.repositories.runs.addSourceDiagnostics(runId, {
        sourceRegistrationId: source.id,
        status: "success",
        startedAt,
        finishedAt: retrievedAt,
        message: result.diagnostics.join("; ") || undefined,
        retrievedEntryCount: result.entries.length,
        acceptedEntryCount: accepted,
      });
      return false;
    } catch (error) {
      this.repositories.runs.addSourceDiagnostics(runId, {
        sourceRegistrationId: source.id,
        status: "failed",
        startedAt,
        finishedAt: new Date().toISOString(),
        message: error instanceof Error ? error.message : String(error),
        retrievedEntryCount: 0,
        acceptedEntryCount: 0,
      });
      return true;
    }
  }

  private markDuplicates(runId: string): void {
    const candidates = this.repositories.candidates.listCandidatesForRun(runId);
    const groups = new Map<string, CandidateEventRecord[]>();
    for (const candidate of candidates) {
      const key = duplicateKey(candidate);
      const group = groups.get(key) ?? [];
      group.push(candidate);
      groups.set(key, group);
    }

    for (const group of groups.values()) {
      if (group.length <= 1) {
        continue;
      }
      const groupId = randomUUID();
      group
        .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt))
        .forEach((candidate, index) => {
          this.repositories.candidates.updateDuplicate(candidate.id, groupId, index > 0);
        });
    }
  }

  private buildRankingSnapshots(runId: string, accounts: MonitoredAccount[]): RankingSnapshot[] {
    const candidates = this.repositories.candidates.listCandidatesForRun(runId);
    const evaluations = this.repositories.evaluations.listEvaluationsForRun(runId);
    const evaluationsByCandidate = new Map(evaluations.map((evaluation) => [evaluation.candidateId, evaluation]));
    const now = new Date().toISOString();

    return accounts.map((account) => {
      const accountCandidates = candidates.filter(
        (candidate) => candidate.accountId === account.id && candidate.prefilterStatus === "matched" && !candidate.isDuplicate,
      );
      const evaluatedPairs = accountCandidates
        .map((candidate) => ({ candidate, evaluation: evaluationsByCandidate.get(candidate.id) }))
        .filter((pair) =>
          pair.evaluation?.state === "evaluated" &&
          Boolean(pair.evaluation.relevanceHypothesis && pair.evaluation.validationAction),
        );
      const rankingScore = evaluatedPairs.reduce(
        (max, pair) => Math.max(max, pair.evaluation?.semanticPriorityScore ?? 0),
        0,
      );
      const latestEvaluatedPublicationDate = evaluatedPairs
        .map((pair) => pair.candidate.publicationDate)
        .sort((left, right) => Date.parse(right) - Date.parse(left))[0];

      return {
        runId,
        accountId: account.id,
        rankingScore,
        evaluatedSignalCount: evaluatedPairs.length,
        awaitingEvaluationCount: accountCandidates.filter((candidate) => !evaluationsByCandidate.has(candidate.id)).length,
        abstainedCount: accountCandidates.filter((candidate) => evaluationsByCandidate.get(candidate.id)?.state === "abstained").length,
        degradedCount: accountCandidates.filter((candidate) => evaluationsByCandidate.get(candidate.id)?.state === "degraded").length,
        failedEvaluationCount: accountCandidates.filter((candidate) => evaluationsByCandidate.get(candidate.id)?.state === "failed").length,
        latestEvaluatedPublicationDate,
        createdAt: now,
      };
    });
  }
}

function buildCandidate(
  runId: string,
  account: MonitoredAccount,
  source: SourceRegistration,
  entry: RawFeedEntry,
): CandidateEventRecord {
  const now = new Date().toISOString();
  const canonicalUrl = canonicalizeUrl(entry.link);
  const matchBasis = matchAccount(account, `${entry.title} ${entry.excerpt}`);
  const excerpt = truncate(entry.excerpt, 1200);
  return {
    id: randomUUID(),
    runId,
    accountId: account.id,
    sourceRegistrationId: source.id,
    title: truncate(entry.title, 300),
    externalFact: truncate(entry.title, 500),
    category: "registered_public_source",
    sourceName: entry.sourceName,
    sourceType: source.sourceType,
    sourceUrl: entry.link,
    canonicalUrl,
    publicationDate: entry.publicationDate,
    retrievedAt: now,
    excerpt,
    contentFingerprint: createHash("sha256")
      .update(`${entry.title}\n${entry.publicationDate}\n${canonicalUrl}\n${excerpt}`)
      .digest("hex"),
    accountMatchBasis: matchBasis.basis,
    prefilterStatus: matchBasis.matched ? "matched" : "filtered",
    prefilterReason: matchBasis.matched ? undefined : "No configured account alias appeared in title or excerpt.",
    isDuplicate: false,
    createdAt: now,
  };
}

function matchAccount(account: MonitoredAccount, text: string): { matched: boolean; basis: string } {
  const normalized = text.toLowerCase();
  const match = account.aliases.find((alias) => normalized.includes(alias.toLowerCase()));
  return match
    ? { matched: true, basis: `Matched configured alias: ${match}` }
    : { matched: false, basis: "No configured alias match" };
}

function duplicateKey(candidate: CandidateEventRecord): string {
  return createHash("sha256")
    .update([
      candidate.accountId,
      candidate.canonicalUrl,
      candidate.title.toLowerCase().replace(/\s+/g, " ").trim(),
      candidate.publicationDate.slice(0, 10),
    ].join("\n"))
    .digest("hex");
}

function canonicalizeUrl(value: string): string {
  try {
    const url = new URL(value);
    url.hash = "";
    for (const parameter of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid)/i.test(parameter)) {
        url.searchParams.delete(parameter);
      }
    }
    return url.toString();
  } catch {
    return value;
  }
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 3)}...` : value;
}
