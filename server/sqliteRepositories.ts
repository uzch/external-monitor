import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import {
  AccountDetailDto,
  AccountSummaryDto,
  CandidateEventRecord,
  CreateAccountRequest,
  CreateSourceRegistrationRequest,
  EvaluationRecord,
  MonitorRun,
  MonitoredAccount,
  RankingSnapshot,
  SourceDiagnostics,
  SourcePolicy,
  SourceRegistration,
  UpdateAccountRequest,
  UpdateSourceRegistrationRequest,
} from "../src/domain/connectedContracts.js";
import {
  AccountSignalBriefDto,
  AccountTeamFeedback,
  accountTeamFeedbackTypes,
  AccountTeamFeedbackType,
  AccountTeamFeedbackRequest,
  PriorityTier,
  ResearchImportRequest,
  ResearchRun,
  ResearchSignal,
} from "../src/domain/researchContracts.js";
import {
  AccountRepository,
  CandidateRepository,
  ConnectedRepositories,
  EvaluationRepository,
  MonitorRunRepository,
  RankingRepository,
  ResearchRepository,
  ReviewFeedbackRepository,
} from "./repositories.js";

type Row = Record<string, unknown>;

const coverageNotice =
  "Connected Monitor v1 monitors active registered sources only. It does not claim full external-world coverage.";

export class SqliteConnectedRepositories implements ConnectedRepositories {
  readonly accounts: AccountRepository;
  readonly runs: MonitorRunRepository;
  readonly candidates: CandidateRepository;
  readonly evaluations: EvaluationRepository;
  readonly rankings: RankingRepository;
  readonly reviewFeedback: ReviewFeedbackRepository;
  readonly research: ResearchRepository;

  private readonly db: DatabaseSync;

  constructor(databasePath: string, private readonly defaultPolicy: SourcePolicy) {
    this.db = new DatabaseSync(databasePath);
    this.db.exec("PRAGMA foreign_keys = ON");
    this.migrate();
    this.accounts = new SqliteAccountRepository(this.db, this.defaultPolicy);
    this.runs = new SqliteMonitorRunRepository(this.db);
    this.candidates = new SqliteCandidateRepository(this.db);
    this.evaluations = new SqliteEvaluationRepository(this.db);
    this.rankings = new SqliteRankingRepository(this.db);
    this.reviewFeedback = new SqliteReviewFeedbackRepository(this.db);
    this.research = new SqliteResearchRepository(this.db);
  }

  close() {
    this.db.close();
  }

  private migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        aliases_json TEXT NOT NULL,
        sector TEXT,
        geography TEXT,
        hierarchy_node_id TEXT NOT NULL,
        hierarchy_label TEXT NOT NULL,
        hierarchy_path_json TEXT NOT NULL,
        mapping_status TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS source_registrations (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id),
        display_name TEXT NOT NULL,
        source_type TEXT NOT NULL,
        url TEXT NOT NULL,
        canonical_domain TEXT,
        state TEXT NOT NULL,
        policy_json TEXT NOT NULL,
        last_retrieved_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS monitor_runs (
        id TEXT PRIMARY KEY,
        state TEXT NOT NULL,
        requested_account_id TEXT,
        started_at TEXT,
        finished_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        warning_count INTEGER NOT NULL,
        error_count INTEGER NOT NULL,
        diagnostics_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS source_diagnostics (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL REFERENCES monitor_runs(id),
        source_registration_id TEXT NOT NULL,
        status TEXT NOT NULL,
        started_at TEXT NOT NULL,
        finished_at TEXT NOT NULL,
        message TEXT,
        retrieved_entry_count INTEGER NOT NULL,
        accepted_entry_count INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS candidates (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL REFERENCES monitor_runs(id),
        account_id TEXT NOT NULL REFERENCES accounts(id),
        source_registration_id TEXT NOT NULL REFERENCES source_registrations(id),
        title TEXT NOT NULL,
        external_fact TEXT NOT NULL,
        category TEXT NOT NULL,
        source_name TEXT NOT NULL,
        source_type TEXT NOT NULL,
        source_url TEXT NOT NULL,
        canonical_url TEXT NOT NULL,
        publication_date TEXT NOT NULL,
        retrieved_at TEXT NOT NULL,
        excerpt TEXT NOT NULL,
        content_fingerprint TEXT NOT NULL,
        account_match_basis TEXT NOT NULL,
        prefilter_status TEXT NOT NULL,
        prefilter_reason TEXT,
        duplicate_group_id TEXT,
        is_duplicate INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS evaluations (
        id TEXT PRIMARY KEY,
        candidate_id TEXT NOT NULL REFERENCES candidates(id),
        run_id TEXT NOT NULL REFERENCES monitor_runs(id),
        account_id TEXT NOT NULL REFERENCES accounts(id),
        state TEXT NOT NULL,
        evaluator_name TEXT NOT NULL,
        evaluator_version TEXT NOT NULL,
        evaluation_policy_version TEXT NOT NULL,
        account_match_basis TEXT NOT NULL,
        external_fact TEXT,
        evidence_reference TEXT,
        selected_capability_ids_json TEXT NOT NULL,
        relevance_hypothesis TEXT,
        uncertainty TEXT,
        abstention_reason TEXT,
        validation_action TEXT,
        factor_scores_json TEXT NOT NULL,
        semantic_priority_score REAL,
        diagnostics TEXT,
        evaluated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS ranking_snapshots (
        run_id TEXT NOT NULL REFERENCES monitor_runs(id),
        account_id TEXT NOT NULL REFERENCES accounts(id),
        ranking_score REAL NOT NULL,
        evaluated_signal_count INTEGER NOT NULL,
        awaiting_evaluation_count INTEGER NOT NULL,
        abstained_count INTEGER NOT NULL,
        degraded_count INTEGER NOT NULL,
        failed_evaluation_count INTEGER NOT NULL,
        latest_evaluated_publication_date TEXT,
        created_at TEXT NOT NULL,
        PRIMARY KEY (run_id, account_id)
      );

      CREATE TABLE IF NOT EXISTS review_feedback (
        id TEXT PRIMARY KEY,
        candidate_id TEXT NOT NULL,
        note TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS research_runs (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id),
        state TEXT NOT NULL,
        import_source TEXT NOT NULL,
        executive_summary TEXT NOT NULL,
        source_plan TEXT NOT NULL,
        sources_checked_json TEXT NOT NULL,
        source_gaps_json TEXT NOT NULL,
        search_queries_used_json TEXT NOT NULL,
        coverage_limitations_json TEXT NOT NULL,
        unknowns_guardrails_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        imported_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS research_signals (
        id TEXT PRIMARY KEY,
        research_run_id TEXT NOT NULL REFERENCES research_runs(id),
        account_id TEXT NOT NULL REFERENCES accounts(id),
        external_fact TEXT NOT NULL,
        source_url TEXT NOT NULL,
        publisher TEXT NOT NULL,
        publication_date TEXT,
        retrieved_at TEXT NOT NULL,
        excerpt TEXT NOT NULL,
        account_match_basis TEXT NOT NULL,
        source_category TEXT NOT NULL,
        disposition TEXT NOT NULL,
        disposition_rationale TEXT NOT NULL,
        red_hat_relevance_hypothesis TEXT,
        validation_question TEXT,
        uncertainty_state TEXT NOT NULL,
        sort_order INTEGER NOT NULL,
        priority_tier TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS account_team_feedback (
        id TEXT PRIMARY KEY,
        research_signal_id TEXT NOT NULL REFERENCES research_signals(id),
        feedback_type TEXT NOT NULL,
        notes TEXT,
        created_at TEXT NOT NULL
      );
    `);
    addColumnIfMissing(this.db, "research_runs", "source_plan", "TEXT NOT NULL DEFAULT ''");
    addColumnIfMissing(this.db, "research_runs", "sources_checked_json", "TEXT NOT NULL DEFAULT '[]'");
    addColumnIfMissing(this.db, "research_runs", "source_gaps_json", "TEXT NOT NULL DEFAULT '[]'");
    addColumnIfMissing(this.db, "research_runs", "search_queries_used_json", "TEXT NOT NULL DEFAULT '[]'");
    addColumnIfMissing(this.db, "research_runs", "coverage_limitations_json", "TEXT NOT NULL DEFAULT '[]'");
    addColumnIfMissing(this.db, "research_signals", "sort_order", "INTEGER NOT NULL DEFAULT 0");
    addColumnIfMissing(this.db, "research_signals", "priority_tier", "TEXT NOT NULL DEFAULT 'none'");
  }
}

class SqliteAccountRepository implements AccountRepository {
  constructor(private readonly db: DatabaseSync, private readonly defaultPolicy: SourcePolicy) {}

  createAccount(input: CreateAccountRequest): MonitoredAccount {
    const now = isoNow();
    const account: MonitoredAccount = {
      id: randomUUID(),
      name: input.name.trim(),
      aliases: normalizeAliases(input.aliases, input.name),
      sector: emptyToUndefined(input.sector),
      geography: emptyToUndefined(input.geography),
      hierarchyNodeId: slug(input.hierarchyLabel ?? "local-scope"),
      hierarchyLabel: input.hierarchyLabel?.trim() || "Local monitored accounts",
      hierarchyPath: input.hierarchyPath?.length ? input.hierarchyPath : ["Local monitored accounts"],
      mappingStatus: input.mappingStatus ?? "partial_validated",
      status: "active",
      createdAt: now,
      updatedAt: now,
    };

    this.db.prepare(`
      INSERT INTO accounts (
        id, name, aliases_json, sector, geography, hierarchy_node_id, hierarchy_label,
        hierarchy_path_json, mapping_status, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      account.id,
      account.name,
      JSON.stringify(account.aliases),
      account.sector ?? null,
      account.geography ?? null,
      account.hierarchyNodeId,
      account.hierarchyLabel,
      JSON.stringify(account.hierarchyPath),
      account.mappingStatus,
      account.status,
      account.createdAt,
      account.updatedAt,
    );

    return account;
  }

  updateAccount(id: string, input: UpdateAccountRequest): MonitoredAccount | undefined {
    const current = this.getAccount(id);
    if (!current) {
      return undefined;
    }

    const updated: MonitoredAccount = {
      ...current,
      name: input.name?.trim() || current.name,
      aliases: input.aliases ? normalizeAliases(input.aliases, input.name ?? current.name) : current.aliases,
      sector: input.sector !== undefined ? emptyToUndefined(input.sector) : current.sector,
      geography: input.geography !== undefined ? emptyToUndefined(input.geography) : current.geography,
      hierarchyNodeId: input.hierarchyLabel ? slug(input.hierarchyLabel) : current.hierarchyNodeId,
      hierarchyLabel: input.hierarchyLabel?.trim() || current.hierarchyLabel,
      hierarchyPath: input.hierarchyPath?.length ? input.hierarchyPath : current.hierarchyPath,
      mappingStatus: input.mappingStatus ?? current.mappingStatus,
      status: input.status ?? current.status,
      updatedAt: isoNow(),
    };

    this.db.prepare(`
      UPDATE accounts SET
        name = ?, aliases_json = ?, sector = ?, geography = ?, hierarchy_node_id = ?,
        hierarchy_label = ?, hierarchy_path_json = ?, mapping_status = ?, status = ?, updated_at = ?
      WHERE id = ?
    `).run(
      updated.name,
      JSON.stringify(updated.aliases),
      updated.sector ?? null,
      updated.geography ?? null,
      updated.hierarchyNodeId,
      updated.hierarchyLabel,
      JSON.stringify(updated.hierarchyPath),
      updated.mappingStatus,
      updated.status,
      updated.updatedAt,
      id,
    );

    return updated;
  }

  listAccounts(includeArchived = false): MonitoredAccount[] {
    const rows = this.db.prepare(
      `SELECT * FROM accounts ${includeArchived ? "" : "WHERE status != 'archived'"} ORDER BY name`,
    ).all() as Row[];
    return rows.map(toAccount);
  }

  getAccount(id: string): MonitoredAccount | undefined {
    const row = this.db.prepare("SELECT * FROM accounts WHERE id = ?").get(id) as Row | undefined;
    return row ? toAccount(row) : undefined;
  }

  createSourceRegistration(input: CreateSourceRegistrationRequest): SourceRegistration {
    const now = isoNow();
    const url = new URL(input.url);
    const source: SourceRegistration = {
      id: randomUUID(),
      accountId: input.accountId,
      displayName: input.displayName.trim(),
      sourceType: "rss_atom",
      url: input.url,
      canonicalDomain: url.hostname.toLowerCase(),
      state: "active",
      policy: { ...this.defaultPolicy, ...input.policy },
      createdAt: now,
      updatedAt: now,
    };

    this.db.prepare(`
      INSERT INTO source_registrations (
        id, account_id, display_name, source_type, url, canonical_domain, state,
        policy_json, last_retrieved_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      source.id,
      source.accountId,
      source.displayName,
      source.sourceType,
      source.url,
      source.canonicalDomain ?? null,
      source.state,
      JSON.stringify(source.policy),
      source.lastRetrievedAt ?? null,
      source.createdAt,
      source.updatedAt,
    );

    return source;
  }

  updateSourceRegistration(
    id: string,
    input: UpdateSourceRegistrationRequest,
  ): SourceRegistration | undefined {
    const current = this.getSourceRegistration(id);
    if (!current) {
      return undefined;
    }

    const url = input.url ? new URL(input.url) : undefined;
    const updated: SourceRegistration = {
      ...current,
      displayName: input.displayName?.trim() || current.displayName,
      url: input.url ?? current.url,
      canonicalDomain: url?.hostname.toLowerCase() ?? current.canonicalDomain,
      state: input.state ?? current.state,
      policy: { ...current.policy, ...input.policy },
      updatedAt: isoNow(),
    };

    this.db.prepare(`
      UPDATE source_registrations SET
        display_name = ?, url = ?, canonical_domain = ?, state = ?, policy_json = ?, updated_at = ?
      WHERE id = ?
    `).run(
      updated.displayName,
      updated.url,
      updated.canonicalDomain ?? null,
      updated.state,
      JSON.stringify(updated.policy),
      updated.updatedAt,
      id,
    );

    return updated;
  }

  listSourceRegistrations(accountId?: string, includeArchived = false): SourceRegistration[] {
    const clauses: string[] = [];
    const values: string[] = [];
    if (accountId) {
      clauses.push("account_id = ?");
      values.push(accountId);
    }
    if (!includeArchived) {
      clauses.push("state != 'archived'");
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const rows = this.db.prepare(
      `SELECT * FROM source_registrations ${where} ORDER BY display_name`,
    ).all(...values) as Row[];
    return rows.map(toSourceRegistration);
  }

  getSourceRegistration(id: string): SourceRegistration | undefined {
    const row = this.db.prepare("SELECT * FROM source_registrations WHERE id = ?").get(id) as
      | Row
      | undefined;
    return row ? toSourceRegistration(row) : undefined;
  }

  markSourceRetrieved(id: string, retrievedAt: string): void {
    this.db.prepare(
      "UPDATE source_registrations SET last_retrieved_at = ?, updated_at = ? WHERE id = ?",
    ).run(retrievedAt, retrievedAt, id);
  }
}

class SqliteMonitorRunRepository implements MonitorRunRepository {
  constructor(private readonly db: DatabaseSync) {}

  createRun(requestedAccountId?: string): MonitorRun {
    const now = isoNow();
    const run: MonitorRun = {
      id: randomUUID(),
      state: "queued",
      requestedAccountId,
      createdAt: now,
      updatedAt: now,
      warningCount: 0,
      errorCount: 0,
      diagnostics: [],
    };
    this.db.prepare(`
      INSERT INTO monitor_runs (
        id, state, requested_account_id, started_at, finished_at, created_at, updated_at,
        warning_count, error_count, diagnostics_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      run.id,
      run.state,
      run.requestedAccountId ?? null,
      null,
      null,
      run.createdAt,
      run.updatedAt,
      run.warningCount,
      run.errorCount,
      JSON.stringify(run.diagnostics),
    );
    return run;
  }

  updateRun(run: MonitorRun): void {
    this.db.prepare(`
      UPDATE monitor_runs SET
        state = ?, requested_account_id = ?, started_at = ?, finished_at = ?, updated_at = ?,
        warning_count = ?, error_count = ?, diagnostics_json = ?
      WHERE id = ?
    `).run(
      run.state,
      run.requestedAccountId ?? null,
      run.startedAt ?? null,
      run.finishedAt ?? null,
      run.updatedAt,
      run.warningCount,
      run.errorCount,
      JSON.stringify(run.diagnostics),
      run.id,
    );
  }

  listRuns(limit: number): MonitorRun[] {
    const rows = this.db.prepare("SELECT * FROM monitor_runs ORDER BY created_at DESC LIMIT ?").all(limit) as Row[];
    return rows.map(toRun);
  }

  getRun(id: string): MonitorRun | undefined {
    const row = this.db.prepare("SELECT * FROM monitor_runs WHERE id = ?").get(id) as Row | undefined;
    return row ? toRun(row) : undefined;
  }

  addSourceDiagnostics(runId: string, diagnostics: SourceDiagnostics): void {
    this.db.prepare(`
      INSERT INTO source_diagnostics (
        id, run_id, source_registration_id, status, started_at, finished_at, message,
        retrieved_entry_count, accepted_entry_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      randomUUID(),
      runId,
      diagnostics.sourceRegistrationId,
      diagnostics.status,
      diagnostics.startedAt,
      diagnostics.finishedAt,
      diagnostics.message ?? null,
      diagnostics.retrievedEntryCount,
      diagnostics.acceptedEntryCount,
    );
  }

  listSourceDiagnostics(runId: string): SourceDiagnostics[] {
    const rows = this.db.prepare(
      "SELECT * FROM source_diagnostics WHERE run_id = ? ORDER BY started_at",
    ).all(runId) as Row[];
    return rows.map(toSourceDiagnostics);
  }
}

class SqliteCandidateRepository implements CandidateRepository {
  constructor(private readonly db: DatabaseSync) {}

  insertCandidate(candidate: CandidateEventRecord): void {
    this.db.prepare(`
      INSERT INTO candidates (
        id, run_id, account_id, source_registration_id, title, external_fact, category,
        source_name, source_type, source_url, canonical_url, publication_date, retrieved_at,
        excerpt, content_fingerprint, account_match_basis, prefilter_status, prefilter_reason,
        duplicate_group_id, is_duplicate, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      candidate.id,
      candidate.runId,
      candidate.accountId,
      candidate.sourceRegistrationId,
      candidate.title,
      candidate.externalFact,
      candidate.category,
      candidate.sourceName,
      candidate.sourceType,
      candidate.sourceUrl,
      candidate.canonicalUrl,
      candidate.publicationDate,
      candidate.retrievedAt,
      candidate.excerpt,
      candidate.contentFingerprint,
      candidate.accountMatchBasis,
      candidate.prefilterStatus,
      candidate.prefilterReason ?? null,
      candidate.duplicateGroupId ?? null,
      candidate.isDuplicate ? 1 : 0,
      candidate.createdAt,
    );
  }

  listCandidatesForRun(runId: string): CandidateEventRecord[] {
    const rows = this.db.prepare("SELECT * FROM candidates WHERE run_id = ? ORDER BY publication_date DESC").all(runId) as Row[];
    return rows.map(toCandidate);
  }

  listCandidatesForAccount(accountId: string): CandidateEventRecord[] {
    const rows = this.db.prepare(
      "SELECT * FROM candidates WHERE account_id = ? ORDER BY publication_date DESC, created_at DESC",
    ).all(accountId) as Row[];
    return rows.map(toCandidate);
  }

  updateDuplicate(candidateId: string, duplicateGroupId: string, isDuplicate: boolean): void {
    this.db.prepare(
      "UPDATE candidates SET duplicate_group_id = ?, is_duplicate = ? WHERE id = ?",
    ).run(duplicateGroupId, isDuplicate ? 1 : 0, candidateId);
  }
}

class SqliteEvaluationRepository implements EvaluationRepository {
  constructor(private readonly db: DatabaseSync) {}

  insertEvaluation(evaluation: EvaluationRecord): void {
    this.db.prepare(`
      INSERT INTO evaluations (
        id, candidate_id, run_id, account_id, state, evaluator_name, evaluator_version,
        evaluation_policy_version, account_match_basis, external_fact, evidence_reference,
        selected_capability_ids_json, relevance_hypothesis, uncertainty, abstention_reason,
        validation_action, factor_scores_json, semantic_priority_score, diagnostics, evaluated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      evaluation.id,
      evaluation.candidateId,
      evaluation.runId,
      evaluation.accountId,
      evaluation.state,
      evaluation.evaluatorName,
      evaluation.evaluatorVersion,
      evaluation.evaluationPolicyVersion,
      evaluation.accountMatchBasis,
      evaluation.externalFact ?? null,
      evaluation.evidenceReference ?? null,
      JSON.stringify(evaluation.selectedCapabilityIds),
      evaluation.relevanceHypothesis ?? null,
      evaluation.uncertainty ?? null,
      evaluation.abstentionReason ?? null,
      evaluation.validationAction ?? null,
      JSON.stringify(evaluation.factorScores),
      evaluation.semanticPriorityScore ?? null,
      evaluation.diagnostics ?? null,
      evaluation.evaluatedAt,
    );
  }

  listEvaluationsForRun(runId: string): EvaluationRecord[] {
    const rows = this.db.prepare("SELECT * FROM evaluations WHERE run_id = ?").all(runId) as Row[];
    return rows.map(toEvaluation);
  }

  listEvaluationsForAccount(accountId: string): EvaluationRecord[] {
    const rows = this.db.prepare(
      "SELECT * FROM evaluations WHERE account_id = ? ORDER BY evaluated_at DESC",
    ).all(accountId) as Row[];
    return rows.map(toEvaluation);
  }
}

class SqliteRankingRepository implements RankingRepository {
  constructor(private readonly db: DatabaseSync) {}

  replaceRankingSnapshots(runId: string, snapshots: RankingSnapshot[]): void {
    this.db.prepare("DELETE FROM ranking_snapshots WHERE run_id = ?").run(runId);
    const statement = this.db.prepare(`
      INSERT INTO ranking_snapshots (
        run_id, account_id, ranking_score, evaluated_signal_count, awaiting_evaluation_count,
        abstained_count, degraded_count, failed_evaluation_count, latest_evaluated_publication_date,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const snapshot of snapshots) {
      statement.run(
        snapshot.runId,
        snapshot.accountId,
        snapshot.rankingScore,
        snapshot.evaluatedSignalCount,
        snapshot.awaitingEvaluationCount,
        snapshot.abstainedCount,
        snapshot.degradedCount,
        snapshot.failedEvaluationCount,
        snapshot.latestEvaluatedPublicationDate ?? null,
        snapshot.createdAt,
      );
    }
  }

  latestAccountSummaries(): AccountSummaryDto[] {
    const accounts = (this.db.prepare("SELECT * FROM accounts WHERE status = 'active' ORDER BY name").all() as Row[])
      .map(toAccount);
    return accounts
      .map((account) => {
        const latest = this.latestSnapshot(account.id);
        const latestEvent = latest?.latestEvaluatedPublicationDate
          ? this.latestEvaluatedCandidate(account.id, latest.latestEvaluatedPublicationDate)
          : undefined;
        const sourceCount = Number(
          (this.db.prepare(
            "SELECT COUNT(*) AS count FROM source_registrations WHERE account_id = ? AND state = 'active'",
          ).get(account.id) as Row).count,
        );
        return {
          account,
          rankingScore: latest?.rankingScore ?? 0,
          evaluatedSignalCount: latest?.evaluatedSignalCount ?? 0,
          awaitingEvaluationCount: latest?.awaitingEvaluationCount ?? 0,
          abstainedCount: latest?.abstainedCount ?? 0,
          degradedCount: latest?.degradedCount ?? 0,
          failedEvaluationCount: latest?.failedEvaluationCount ?? 0,
          latestEvaluatedEvent: latestEvent,
          sourceCount,
        };
      })
      .sort((left, right) => {
        if (right.rankingScore !== left.rankingScore) {
          return right.rankingScore - left.rankingScore;
        }
        return left.account.name.localeCompare(right.account.name);
      });
  }

  getAccountDetail(accountId: string): AccountDetailDto | undefined {
    const accountRow = this.db.prepare("SELECT * FROM accounts WHERE id = ?").get(accountId) as
      | Row
      | undefined;
    if (!accountRow) {
      return undefined;
    }

    const account = toAccount(accountRow);
    const candidates = (this.db.prepare(
      "SELECT * FROM candidates WHERE account_id = ? ORDER BY publication_date DESC, created_at DESC",
    ).all(accountId) as Row[]).map(toCandidate);
    const evaluations = (this.db.prepare(
      "SELECT * FROM evaluations WHERE account_id = ? ORDER BY evaluated_at DESC",
    ).all(accountId) as Row[]).map(toEvaluation);
    const byCandidate = new Map(evaluations.map((evaluation) => [evaluation.candidateId, evaluation]));
    const sourceRegistrations = (this.db.prepare(
      "SELECT * FROM source_registrations WHERE account_id = ? AND state != 'archived' ORDER BY display_name",
    ).all(accountId) as Row[]).map(toSourceRegistration);

    return {
      account,
      sourceRegistrations,
      evaluatedSignals: joinByState(candidates, byCandidate, "evaluated")
        .filter(({ evaluation }) => Boolean(evaluation.relevanceHypothesis && evaluation.validationAction))
        .sort(sortSignalPairs),
      awaitingEvaluation: candidates.filter((candidate) => !byCandidate.has(candidate.id)),
      abstainedSignals: joinByState(candidates, byCandidate, "abstained"),
      degradedSignals: joinByState(candidates, byCandidate, "degraded"),
      failedEvaluations: joinByState(candidates, byCandidate, "failed"),
      coverageNotice,
    };
  }

  private latestSnapshot(accountId: string): RankingSnapshot | undefined {
    const row = this.db.prepare(`
      SELECT rs.* FROM ranking_snapshots rs
      JOIN monitor_runs mr ON mr.id = rs.run_id
      WHERE rs.account_id = ? AND mr.state IN ('completed', 'completed_with_warnings')
      ORDER BY mr.created_at DESC LIMIT 1
    `).get(accountId) as Row | undefined;
    return row ? toRankingSnapshot(row) : undefined;
  }

  private latestEvaluatedCandidate(
    accountId: string,
    publicationDate: string,
  ): CandidateEventRecord | undefined {
    const row = this.db.prepare(`
      SELECT c.* FROM candidates c
      JOIN evaluations e ON e.candidate_id = c.id
      WHERE c.account_id = ? AND c.publication_date = ? AND e.state = 'evaluated'
      ORDER BY e.semantic_priority_score DESC, c.created_at DESC LIMIT 1
    `).get(accountId, publicationDate) as Row | undefined;
    return row ? toCandidate(row) : undefined;
  }
}

class SqliteReviewFeedbackRepository implements ReviewFeedbackRepository {
  constructor(private readonly db: DatabaseSync) {}

  recordFeedbackPlaceholder(candidateId: string, note: string): void {
    this.db.prepare(
      "INSERT INTO review_feedback (id, candidate_id, note, created_at) VALUES (?, ?, ?, ?)",
    ).run(randomUUID(), candidateId, note, isoNow());
  }
}

class SqliteResearchRepository implements ResearchRepository {
  constructor(private readonly db: DatabaseSync) {}

  importResearchRun(input: ResearchImportRequest): { run: ResearchRun; signals: ResearchSignal[] } {
    const now = isoNow();
    const run: ResearchRun = {
      id: randomUUID(),
      accountId: input.accountId,
      state: "imported",
      importSource: input.importSource ?? "gpt_assisted",
      executiveSummary: input.executiveSummary.trim(),
      sourcePlan: input.sourcePlan.trim(),
      sourcesChecked: input.sourcesChecked.map((item) => item.trim()),
      sourceGaps: input.sourceGaps.map((item) => item.trim()),
      searchQueriesUsed: input.searchQueriesUsed.map((item) => item.trim()),
      coverageLimitations: input.coverageLimitations.map((item) => item.trim()),
      unknownsAndGuardrails: input.unknownsAndGuardrails.map((item) => item.trim()),
      createdAt: now,
      updatedAt: now,
      importedAt: now,
    };

    this.db.prepare(`
      INSERT INTO research_runs (
        id, account_id, state, import_source, executive_summary, unknowns_guardrails_json,
        source_plan, sources_checked_json, source_gaps_json, search_queries_used_json,
        coverage_limitations_json, created_at, updated_at, imported_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      run.id,
      run.accountId,
      run.state,
      run.importSource,
      run.executiveSummary,
      JSON.stringify(run.unknownsAndGuardrails),
      run.sourcePlan,
      JSON.stringify(run.sourcesChecked),
      JSON.stringify(run.sourceGaps),
      JSON.stringify(run.searchQueriesUsed),
      JSON.stringify(run.coverageLimitations),
      run.createdAt,
      run.updatedAt,
      run.importedAt,
    );

    const statement = this.db.prepare(`
      INSERT INTO research_signals (
        id, research_run_id, account_id, external_fact, source_url, publisher,
        publication_date, retrieved_at, excerpt, account_match_basis, source_category,
        disposition, disposition_rationale, red_hat_relevance_hypothesis,
        validation_question, uncertainty_state, sort_order, priority_tier, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const signals = input.signals.map((signal, index): ResearchSignal => ({
      id: randomUUID(),
      researchRunId: run.id,
      accountId: run.accountId,
      externalFact: signal.externalFact.trim(),
      sourceUrl: signal.sourceUrl,
      publisher: signal.publisher.trim(),
      publicationDate: signal.publicationDate,
      retrievedAt: signal.retrievedAt ?? now,
      excerpt: signal.excerpt.trim(),
      accountMatchBasis: signal.accountMatchBasis.trim(),
      sourceCategory: signal.sourceCategory.trim(),
      disposition: signal.disposition,
      dispositionRationale: signal.dispositionRationale.trim(),
      redHatRelevanceHypothesis: emptyToUndefined(signal.redHatRelevanceHypothesis),
      validationQuestion: emptyToUndefined(signal.validationQuestion),
      uncertaintyState: signal.uncertaintyState,
      sortOrder: signal.sortOrder ?? index,
      priorityTier: signal.priorityTier ?? "none",
      createdAt: now,
    }));

    for (const signal of signals) {
      statement.run(
        signal.id,
        signal.researchRunId,
        signal.accountId,
        signal.externalFact,
        signal.sourceUrl,
        signal.publisher,
        signal.publicationDate ?? null,
        signal.retrievedAt,
        signal.excerpt,
        signal.accountMatchBasis,
        signal.sourceCategory,
        signal.disposition,
        signal.dispositionRationale,
        signal.redHatRelevanceHypothesis ?? null,
        signal.validationQuestion ?? null,
        signal.uncertaintyState,
        signal.sortOrder,
        signal.priorityTier,
        signal.createdAt,
      );
    }

    return { run, signals };
  }

  getLatestBrief(accountId: string): AccountSignalBriefDto | undefined {
    const accountRow = this.db.prepare("SELECT * FROM accounts WHERE id = ?").get(accountId) as Row | undefined;
    if (!accountRow) {
      return undefined;
    }

    const account = toAccount(accountRow);
    const runRow = this.db.prepare(
      "SELECT * FROM research_runs WHERE account_id = ? ORDER BY imported_at DESC LIMIT 1",
    ).get(accountId) as Row | undefined;
    const run = runRow ? toResearchRun(runRow) : undefined;
    const signals = run
      ? (this.db.prepare(
        "SELECT * FROM research_signals WHERE research_run_id = ?",
      ).all(run.id) as Row[]).map(toResearchSignal)
        .sort(sortResearchSignals)
      : [];
    const feedback = run ? this.listFeedbackForRun(run.id) : [];

    const topSignalsToValidate = signals.filter((signal) => signal.disposition === "keep");
    const watchItems = signals.filter((signal) => signal.disposition === "watch");
    const rejectedNoise = signals.filter((signal) => signal.disposition === "reject");
    const abstainedSignals = signals.filter((signal) => signal.disposition === "abstain");

    return {
      account,
      latestResearchRun: run,
      executiveSummary: run?.executiveSummary ??
        "No live research run has completed for this account yet.",
      topSignalsToValidate,
      watchItems,
      rejectedNoise,
      abstainedSignals,
      evidenceTable: signals,
      validationQuestions: [...topSignalsToValidate, ...watchItems]
        .map((signal) => signal.validationQuestion)
        .filter((question): question is string => Boolean(question)),
      unknownsAndGuardrails: run?.unknownsAndGuardrails ?? [
        "No live research has been reviewed for this account.",
        "Do not infer customer intent, demand, fit, deployment, renewal, ownership, or coverage from raw external evidence.",
      ],
      feedbackSummary: summarizeFeedback(feedback),
      feedback,
    };
  }

  recordSignalFeedback(signalId: string, input: AccountTeamFeedbackRequest): AccountTeamFeedback | undefined {
    const signal = this.db.prepare("SELECT id FROM research_signals WHERE id = ?").get(signalId) as Row | undefined;
    if (!signal) {
      return undefined;
    }

    const feedback: AccountTeamFeedback = {
      id: randomUUID(),
      researchSignalId: signalId,
      feedbackType: input.feedbackType,
      notes: emptyToUndefined(input.notes),
      createdAt: isoNow(),
    };
    this.db.prepare(`
      INSERT INTO account_team_feedback (id, research_signal_id, feedback_type, notes, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      feedback.id,
      feedback.researchSignalId,
      feedback.feedbackType,
      feedback.notes ?? null,
      feedback.createdAt,
    );
    return feedback;
  }

  listFeedbackForRun(runId: string): AccountTeamFeedback[] {
    const rows = this.db.prepare(`
      SELECT f.* FROM account_team_feedback f
      JOIN research_signals s ON s.id = f.research_signal_id
      WHERE s.research_run_id = ?
      ORDER BY f.created_at DESC
    `).all(runId) as Row[];
    return rows.map(toAccountTeamFeedback);
  }
}

function toAccount(row: Row): MonitoredAccount {
  return {
    id: text(row.id),
    name: text(row.name),
    aliases: parseJson<string[]>(row.aliases_json, []),
    sector: maybeText(row.sector),
    geography: maybeText(row.geography),
    hierarchyNodeId: text(row.hierarchy_node_id),
    hierarchyLabel: text(row.hierarchy_label),
    hierarchyPath: parseJson<string[]>(row.hierarchy_path_json, []),
    mappingStatus: text(row.mapping_status) as MonitoredAccount["mappingStatus"],
    status: text(row.status) as MonitoredAccount["status"],
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
  };
}

function toSourceRegistration(row: Row): SourceRegistration {
  return {
    id: text(row.id),
    accountId: text(row.account_id),
    displayName: text(row.display_name),
    sourceType: "rss_atom",
    url: text(row.url),
    canonicalDomain: maybeText(row.canonical_domain),
    state: text(row.state) as SourceRegistration["state"],
    policy: parseJson<SourcePolicy>(row.policy_json, {
      minIntervalMinutes: 30,
      timeoutMs: 8000,
      maxEntriesPerRun: 25,
      maxResponseBytes: 1_000_000,
    }),
    lastRetrievedAt: maybeText(row.last_retrieved_at),
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
  };
}

function toRun(row: Row): MonitorRun {
  return {
    id: text(row.id),
    state: text(row.state) as MonitorRun["state"],
    requestedAccountId: maybeText(row.requested_account_id),
    startedAt: maybeText(row.started_at),
    finishedAt: maybeText(row.finished_at),
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
    warningCount: Number(row.warning_count),
    errorCount: Number(row.error_count),
    diagnostics: parseJson<string[]>(row.diagnostics_json, []),
  };
}

function toSourceDiagnostics(row: Row): SourceDiagnostics {
  return {
    sourceRegistrationId: text(row.source_registration_id),
    status: text(row.status) as SourceDiagnostics["status"],
    startedAt: text(row.started_at),
    finishedAt: text(row.finished_at),
    message: maybeText(row.message),
    retrievedEntryCount: Number(row.retrieved_entry_count),
    acceptedEntryCount: Number(row.accepted_entry_count),
  };
}

function toCandidate(row: Row): CandidateEventRecord {
  return {
    id: text(row.id),
    runId: text(row.run_id),
    accountId: text(row.account_id),
    sourceRegistrationId: text(row.source_registration_id),
    title: text(row.title),
    externalFact: text(row.external_fact),
    category: text(row.category),
    sourceName: text(row.source_name),
    sourceType: text(row.source_type),
    sourceUrl: text(row.source_url),
    canonicalUrl: text(row.canonical_url),
    publicationDate: text(row.publication_date),
    retrievedAt: text(row.retrieved_at),
    excerpt: text(row.excerpt),
    contentFingerprint: text(row.content_fingerprint),
    accountMatchBasis: text(row.account_match_basis),
    prefilterStatus: text(row.prefilter_status) as CandidateEventRecord["prefilterStatus"],
    prefilterReason: maybeText(row.prefilter_reason),
    duplicateGroupId: maybeText(row.duplicate_group_id),
    isDuplicate: Boolean(row.is_duplicate),
    createdAt: text(row.created_at),
  };
}

function toEvaluation(row: Row): EvaluationRecord {
  return {
    id: text(row.id),
    candidateId: text(row.candidate_id),
    runId: text(row.run_id),
    accountId: text(row.account_id),
    state: text(row.state) as EvaluationRecord["state"],
    evaluatorName: text(row.evaluator_name),
    evaluatorVersion: text(row.evaluator_version),
    evaluationPolicyVersion: text(row.evaluation_policy_version),
    accountMatchBasis: text(row.account_match_basis),
    externalFact: maybeText(row.external_fact),
    evidenceReference: maybeText(row.evidence_reference),
    selectedCapabilityIds: parseJson<string[]>(row.selected_capability_ids_json, []),
    relevanceHypothesis: maybeText(row.relevance_hypothesis),
    uncertainty: maybeText(row.uncertainty),
    abstentionReason: maybeText(row.abstention_reason),
    validationAction: maybeText(row.validation_action),
    factorScores: parseJson<Record<string, number>>(row.factor_scores_json, {}),
    semanticPriorityScore: row.semantic_priority_score === null || row.semantic_priority_score === undefined
      ? undefined
      : Number(row.semantic_priority_score),
    diagnostics: maybeText(row.diagnostics),
    evaluatedAt: text(row.evaluated_at),
  };
}

function toRankingSnapshot(row: Row): RankingSnapshot {
  return {
    runId: text(row.run_id),
    accountId: text(row.account_id),
    rankingScore: Number(row.ranking_score),
    evaluatedSignalCount: Number(row.evaluated_signal_count),
    awaitingEvaluationCount: Number(row.awaiting_evaluation_count),
    abstainedCount: Number(row.abstained_count),
    degradedCount: Number(row.degraded_count),
    failedEvaluationCount: Number(row.failed_evaluation_count),
    latestEvaluatedPublicationDate: maybeText(row.latest_evaluated_publication_date),
    createdAt: text(row.created_at),
  };
}

function toResearchRun(row: Row): ResearchRun {
  return {
    id: text(row.id),
    accountId: text(row.account_id),
    state: text(row.state) as ResearchRun["state"],
    importSource: text(row.import_source) as ResearchRun["importSource"],
    executiveSummary: text(row.executive_summary),
    sourcePlan: text(row.source_plan),
    sourcesChecked: parseJson<string[]>(row.sources_checked_json, []),
    sourceGaps: parseJson<string[]>(row.source_gaps_json, []),
    searchQueriesUsed: parseJson<string[]>(row.search_queries_used_json, []),
    coverageLimitations: parseJson<string[]>(row.coverage_limitations_json, []),
    unknownsAndGuardrails: parseJson<string[]>(row.unknowns_guardrails_json, []),
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
    importedAt: text(row.imported_at),
  };
}

function toResearchSignal(row: Row): ResearchSignal {
  return {
    id: text(row.id),
    researchRunId: text(row.research_run_id),
    accountId: text(row.account_id),
    externalFact: text(row.external_fact),
    sourceUrl: text(row.source_url),
    publisher: text(row.publisher),
    publicationDate: maybeText(row.publication_date),
    retrievedAt: text(row.retrieved_at),
    excerpt: text(row.excerpt),
    accountMatchBasis: text(row.account_match_basis),
    sourceCategory: text(row.source_category),
    disposition: text(row.disposition) as ResearchSignal["disposition"],
    dispositionRationale: text(row.disposition_rationale),
    redHatRelevanceHypothesis: maybeText(row.red_hat_relevance_hypothesis),
    validationQuestion: maybeText(row.validation_question),
    uncertaintyState: text(row.uncertainty_state) as ResearchSignal["uncertaintyState"],
    sortOrder: Number(row.sort_order),
    priorityTier: text(row.priority_tier) as PriorityTier,
    createdAt: text(row.created_at),
  };
}

function toAccountTeamFeedback(row: Row): AccountTeamFeedback {
  return {
    id: text(row.id),
    researchSignalId: text(row.research_signal_id),
    feedbackType: text(row.feedback_type) as AccountTeamFeedback["feedbackType"],
    notes: maybeText(row.notes),
    createdAt: text(row.created_at),
  };
}

function joinByState(
  candidates: CandidateEventRecord[],
  evaluations: Map<string, EvaluationRecord>,
  state: EvaluationRecord["state"],
) {
  return candidates
    .map((candidate) => ({ candidate, evaluation: evaluations.get(candidate.id) }))
    .filter((pair): pair is { candidate: CandidateEventRecord; evaluation: EvaluationRecord } =>
      pair.evaluation?.state === state
    );
}

function sortSignalPairs(
  left: { candidate: CandidateEventRecord; evaluation: EvaluationRecord },
  right: { candidate: CandidateEventRecord; evaluation: EvaluationRecord },
) {
  const rightScore = right.evaluation.semanticPriorityScore ?? 0;
  const leftScore = left.evaluation.semanticPriorityScore ?? 0;
  if (rightScore !== leftScore) {
    return rightScore - leftScore;
  }
  return Date.parse(right.candidate.publicationDate) - Date.parse(left.candidate.publicationDate);
}

function sortResearchSignals(left: ResearchSignal, right: ResearchSignal) {
  if (left.sortOrder !== right.sortOrder) {
    return left.sortOrder - right.sortOrder;
  }

  const priorityDifference = priorityRank(left.priorityTier) - priorityRank(right.priorityTier);
  if (priorityDifference !== 0) {
    return priorityDifference;
  }

  return Date.parse(right.createdAt) - Date.parse(left.createdAt);
}

function priorityRank(tier: PriorityTier): number {
  return { high: 0, medium: 1, low: 2, none: 3 }[tier];
}

function summarizeFeedback(feedback: AccountTeamFeedback[]): Record<AccountTeamFeedbackType, number> {
  const summary = Object.fromEntries(accountTeamFeedbackTypes.map((type) => [type, 0])) as
    Record<AccountTeamFeedbackType, number>;
  for (const item of feedback) {
    summary[item.feedbackType] += 1;
  }
  return summary;
}

function addColumnIfMissing(db: DatabaseSync, table: string, column: string, definition: string) {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Row[];
  if (!rows.some((row) => text(row.name) === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function normalizeAliases(aliases: string[], name: string): string[] {
  return Array.from(new Set([name, ...aliases].map((alias) => alias.trim()).filter(Boolean)));
}

function emptyToUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "local-scope";
}

function isoNow() {
  return new Date().toISOString();
}

function text(value: unknown): string {
  return String(value ?? "");
}

function maybeText(value: unknown): string | undefined {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }
  return String(value);
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") {
    return fallback;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
