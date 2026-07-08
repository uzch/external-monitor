export const evaluationStates = [
  "awaiting_evaluation",
  "evaluated",
  "abstained",
  "degraded",
  "failed",
] as const;

export const monitorRunStates = [
  "queued",
  "running",
  "retrieving",
  "normalizing",
  "deduplicating",
  "awaiting_evaluation",
  "evaluating",
  "ranking",
  "completed",
  "completed_with_warnings",
  "failed",
  "cancelled",
] as const;

export const sourceRegistrationStates = ["active", "inactive", "archived"] as const;

export type EvaluationState = (typeof evaluationStates)[number];
export type MonitorRunState = (typeof monitorRunStates)[number];
export type SourceRegistrationState = (typeof sourceRegistrationStates)[number];

export interface MonitoredAccount {
  id: string;
  name: string;
  aliases: string[];
  sector?: string;
  geography?: string;
  hierarchyNodeId: string;
  hierarchyLabel: string;
  hierarchyPath: string[];
  mappingStatus: "illustrative" | "partial_validated" | "validated";
  status: "active" | "inactive" | "archived";
  createdAt: string;
  updatedAt: string;
}

export interface SourcePolicy {
  minIntervalMinutes: number;
  timeoutMs: number;
  maxEntriesPerRun: number;
  maxResponseBytes: number;
}

export interface SourceRegistration {
  id: string;
  accountId: string;
  displayName: string;
  sourceType: "rss_atom";
  url: string;
  canonicalDomain?: string;
  state: SourceRegistrationState;
  policy: SourcePolicy;
  lastRetrievedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SourceDiagnostics {
  sourceRegistrationId: string;
  status: "success" | "skipped" | "failed";
  startedAt: string;
  finishedAt: string;
  message?: string;
  retrievedEntryCount: number;
  acceptedEntryCount: number;
}

export interface BoundedEvidence {
  title: string;
  publicationDate: string;
  canonicalUrl: string;
  excerpt: string;
  retrievedAt: string;
  contentFingerprint: string;
  sourceName: string;
  sourceType: string;
  sourceRegistrationId: string;
}

export interface CandidateEventRecord {
  id: string;
  runId: string;
  accountId: string;
  sourceRegistrationId: string;
  title: string;
  externalFact: string;
  category: string;
  sourceName: string;
  sourceType: string;
  sourceUrl: string;
  canonicalUrl: string;
  publicationDate: string;
  retrievedAt: string;
  excerpt: string;
  contentFingerprint: string;
  accountMatchBasis: string;
  prefilterStatus: "matched" | "filtered";
  prefilterReason?: string;
  duplicateGroupId?: string;
  isDuplicate: boolean;
  createdAt: string;
}

export interface EvaluationRecord {
  id: string;
  candidateId: string;
  runId: string;
  accountId: string;
  state: EvaluationState;
  evaluatorName: string;
  evaluatorVersion: string;
  evaluationPolicyVersion: string;
  accountMatchBasis: string;
  externalFact?: string;
  evidenceReference?: string;
  selectedCapabilityIds: string[];
  relevanceHypothesis?: string;
  uncertainty?: string;
  abstentionReason?: string;
  validationAction?: string;
  factorScores: Record<string, number>;
  semanticPriorityScore?: number;
  diagnostics?: string;
  evaluatedAt: string;
}

export interface RankingSnapshot {
  runId: string;
  accountId: string;
  rankingScore: number;
  evaluatedSignalCount: number;
  awaitingEvaluationCount: number;
  abstainedCount: number;
  degradedCount: number;
  failedEvaluationCount: number;
  latestEvaluatedPublicationDate?: string;
  createdAt: string;
}

export interface MonitorRun {
  id: string;
  state: MonitorRunState;
  requestedAccountId?: string;
  startedAt?: string;
  finishedAt?: string;
  createdAt: string;
  updatedAt: string;
  warningCount: number;
  errorCount: number;
  diagnostics: string[];
}

export interface AccountSummaryDto {
  account: MonitoredAccount;
  rankingScore: number;
  evaluatedSignalCount: number;
  awaitingEvaluationCount: number;
  abstainedCount: number;
  degradedCount: number;
  failedEvaluationCount: number;
  latestEvaluatedEvent?: CandidateEventRecord;
  sourceCount: number;
}

export interface PortfolioDto {
  accounts: AccountSummaryDto[];
  coverageNotice: string;
  latestRun?: MonitorRun;
}

export interface AccountDetailDto {
  account: MonitoredAccount;
  sourceRegistrations: SourceRegistration[];
  evaluatedSignals: Array<{ candidate: CandidateEventRecord; evaluation: EvaluationRecord }>;
  awaitingEvaluation: CandidateEventRecord[];
  abstainedSignals: Array<{ candidate: CandidateEventRecord; evaluation: EvaluationRecord }>;
  degradedSignals: Array<{ candidate: CandidateEventRecord; evaluation: EvaluationRecord }>;
  failedEvaluations: Array<{ candidate: CandidateEventRecord; evaluation: EvaluationRecord }>;
  coverageNotice: string;
}

export interface HealthDto {
  status: "ok" | "degraded";
  storage: "available" | "unavailable";
  sourceConnector: "rss_atom";
  evaluator: "configured" | "unconfigured";
  warnings: string[];
}

export interface CreateAccountRequest {
  name: string;
  aliases: string[];
  sector?: string;
  geography?: string;
  hierarchyLabel?: string;
  hierarchyPath?: string[];
  mappingStatus?: MonitoredAccount["mappingStatus"];
}

export interface UpdateAccountRequest extends Partial<CreateAccountRequest> {
  status?: MonitoredAccount["status"];
}

export interface CreateSourceRegistrationRequest {
  accountId: string;
  displayName: string;
  url: string;
  policy?: Partial<SourcePolicy>;
}
export interface UpdateSourceRegistrationRequest {
  displayName?: string;
  url?: string;
  state?: SourceRegistrationState;
  policy?: Partial<SourcePolicy>;
}
