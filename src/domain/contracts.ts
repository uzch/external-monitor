export const mappingStatuses = [
  "illustrative",
  "partial_validated",
  "validated",
] as const;

export const dispositions = [
  "prioritized",
  "monitor",
  "context",
  "excluded",
  "duplicate",
] as const;

export type MappingStatus = (typeof mappingStatuses)[number];
export type Disposition = (typeof dispositions)[number];

export interface SourceRef {
  fixture: string;
  recordId: string;
}

export interface HierarchyNode {
  id: string;
  parentId?: string;
  level: string;
  label: string;
  path: string[];
  sourceRef: SourceRef;
  effectiveStart?: string;
  effectiveEnd?: string;
}

export interface Account {
  id: string;
  name: string;
  aliases: string[];
  sector?: string;
  geography?: string;
  sourceRef: SourceRef;
}

export interface AccountAssignment {
  id: string;
  accountId: string;
  hierarchyNodeId: string;
  assignmentType: string;
  mappingStatus: MappingStatus;
  effectiveStart?: string;
  effectiveEnd?: string;
  sourceRef: SourceRef;
}

export interface ExternalEvent {
  id: string;
  accountId: string;
  title: string;
  externalFact: string;
  category: string;
  sourceName: string;
  sourceType: string;
  sourceUrl: string;
  publicationDate: string;
  retrievedAt: string;
  firstSeenAt?: string;
  excerpt?: string;
  duplicateGroupId?: string;
  sourceRef: SourceRef;
}

export interface RelevanceEvaluation {
  id: string;
  eventId: string;
  evaluatorVersion: string;
  generalRedHatRelevance: string;
  accountSpecificRelevance?: string;
  validationAction: string;
  disposition: Disposition;
  priorityScore: number;
  factorScores: Record<string, number>;
  rationale: string;
  evaluatedAt: string;
}

export interface RedHatCapability {
  id: string;
  name: string;
  description: string;
  themes: string[];
  sourceRef: SourceRef;
  active: boolean;
}

export interface SignalRecord {
  event: ExternalEvent;
  evaluation: RelevanceEvaluation;
}

export interface FixtureDataset {
  hierarchyNodes: HierarchyNode[];
  accounts: Account[];
  accountAssignments: AccountAssignment[];
  externalEvents: ExternalEvent[];
  relevanceEvaluations: RelevanceEvaluation[];
  redHatCapabilities: RedHatCapability[];
}
