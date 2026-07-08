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
  SourceRegistration,
  UpdateAccountRequest,
  UpdateSourceRegistrationRequest,
} from "../src/domain/connectedContracts.js";

export interface AccountRepository {
  createAccount(input: CreateAccountRequest): MonitoredAccountRecord;
  updateAccount(id: string, input: UpdateAccountRequest): MonitoredAccountRecord | undefined;
  listAccounts(includeArchived?: boolean): MonitoredAccountRecord[];
  getAccount(id: string): MonitoredAccountRecord | undefined;
  createSourceRegistration(input: CreateSourceRegistrationRequest): SourceRegistration;
  updateSourceRegistration(
    id: string,
    input: UpdateSourceRegistrationRequest,
  ): SourceRegistration | undefined;
  markSourceRetrieved(id: string, retrievedAt: string): void;
  listSourceRegistrations(accountId?: string, includeArchived?: boolean): SourceRegistration[];
  getSourceRegistration(id: string): SourceRegistration | undefined;
}

export interface MonitorRunRepository {
  createRun(requestedAccountId?: string): MonitorRun;
  updateRun(run: MonitorRun): void;
  listRuns(limit: number): MonitorRun[];
  getRun(id: string): MonitorRun | undefined;
  addSourceDiagnostics(runId: string, diagnostics: SourceDiagnostics): void;
  listSourceDiagnostics(runId: string): SourceDiagnostics[];
}

export interface CandidateRepository {
  insertCandidate(candidate: CandidateEventRecord): void;
  listCandidatesForRun(runId: string): CandidateEventRecord[];
  listCandidatesForAccount(accountId: string): CandidateEventRecord[];
  updateDuplicate(candidateId: string, duplicateGroupId: string, isDuplicate: boolean): void;
}

export interface EvaluationRepository {
  insertEvaluation(evaluation: EvaluationRecord): void;
  listEvaluationsForRun(runId: string): EvaluationRecord[];
  listEvaluationsForAccount(accountId: string): EvaluationRecord[];
}

export interface RankingRepository {
  replaceRankingSnapshots(runId: string, snapshots: RankingSnapshot[]): void;
  latestAccountSummaries(): AccountSummaryDto[];
  getAccountDetail(accountId: string): AccountDetailDto | undefined;
}

export interface ReviewFeedbackRepository {
  recordFeedbackPlaceholder(candidateId: string, note: string): void;
}

export interface ConnectedRepositories {
  accounts: AccountRepository;
  runs: MonitorRunRepository;
  candidates: CandidateRepository;
  evaluations: EvaluationRepository;
  rankings: RankingRepository;
  reviewFeedback: ReviewFeedbackRepository;
}

export type MonitoredAccountRecord = MonitoredAccount;
