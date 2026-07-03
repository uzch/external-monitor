import { z } from "zod";
import {
  dispositions,
  FixtureDataset,
  mappingStatuses,
} from "./contracts";

const sourceRefSchema = z.object({
  fixture: z.string().min(1),
  recordId: z.string().min(1),
});

const optionalIsoDate = z
  .string()
  .datetime({ offset: true })
  .optional();

const hierarchyNodeSchema = z.object({
  id: z.string().min(1),
  parentId: z.string().min(1).optional(),
  level: z.string().min(1),
  label: z.string().min(1),
  path: z.array(z.string().min(1)).min(1),
  sourceRef: sourceRefSchema,
  effectiveStart: optionalIsoDate,
  effectiveEnd: optionalIsoDate,
});

const accountSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  aliases: z.array(z.string()),
  sector: z.string().min(1).optional(),
  geography: z.string().min(1).optional(),
  sourceRef: sourceRefSchema,
});

const assignmentSchema = z.object({
  id: z.string().min(1),
  accountId: z.string().min(1),
  hierarchyNodeId: z.string().min(1),
  assignmentType: z.string().min(1),
  mappingStatus: z.enum(mappingStatuses),
  effectiveStart: optionalIsoDate,
  effectiveEnd: optionalIsoDate,
  sourceRef: sourceRefSchema,
});

const externalEventSchema = z.object({
  id: z.string().min(1),
  accountId: z.string().min(1),
  title: z.string().min(1),
  externalFact: z.string().min(1),
  category: z.string().min(1),
  sourceName: z.string().min(1),
  sourceType: z.string().min(1),
  sourceUrl: z.string().url(),
  publicationDate: z.string().datetime({ offset: true }),
  retrievedAt: z.string().datetime({ offset: true }),
  firstSeenAt: optionalIsoDate,
  excerpt: z.string().min(1).optional(),
  duplicateGroupId: z.string().min(1).optional(),
  sourceRef: sourceRefSchema,
});

const relevanceEvaluationSchema = z.object({
  id: z.string().min(1),
  eventId: z.string().min(1),
  evaluatorVersion: z.string().min(1),
  generalRedHatRelevance: z.string().min(1),
  accountSpecificRelevance: z.string().min(1).optional(),
  validationAction: z.string().min(1),
  disposition: z.enum(dispositions),
  priorityScore: z.number().finite().min(0),
  factorScores: z.record(z.number().finite()),
  rationale: z.string().min(1),
  evaluatedAt: z.string().datetime({ offset: true }),
});

const capabilitySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  themes: z.array(z.string().min(1)),
  sourceRef: sourceRefSchema,
  active: z.boolean(),
});

const fixtureDatasetSchema = z.object({
  hierarchyNodes: z.array(hierarchyNodeSchema),
  accounts: z.array(accountSchema),
  accountAssignments: z.array(assignmentSchema),
  externalEvents: z.array(externalEventSchema),
  relevanceEvaluations: z.array(relevanceEvaluationSchema),
  redHatCapabilities: z.array(capabilitySchema),
});

const prohibitedIntentClaims = [
  "intends to",
  "plans to buy",
  "will buy",
  "is a red hat customer",
  "owns red hat",
  "renewal",
  "opportunity",
  "demand for red hat",
  "product fit",
];

export class DataValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Fixture validation failed: ${issues.join("; ")}`);
    this.name = "DataValidationError";
  }
}

export function parseFixtureDataset(input: unknown): FixtureDataset {
  const parsed = fixtureDatasetSchema.safeParse(input);
  if (!parsed.success) {
    throw new DataValidationError(
      parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
    );
  }

  const dataset = parsed.data;
  const issues = validateDatasetReferences(dataset);

  if (issues.length > 0) {
    throw new DataValidationError(issues);
  }

  return dataset;
}

export function validateDatasetReferences(dataset: FixtureDataset): string[] {
  const issues: string[] = [];
  const hierarchyIds = new Set(dataset.hierarchyNodes.map((node) => node.id));
  const accountIds = new Set(dataset.accounts.map((account) => account.id));
  const eventIds = new Set(dataset.externalEvents.map((event) => event.id));
  const evaluationEventIds = new Set(
    dataset.relevanceEvaluations.map((evaluation) => evaluation.eventId),
  );

  for (const node of dataset.hierarchyNodes) {
    if (node.parentId && !hierarchyIds.has(node.parentId)) {
      issues.push(`Hierarchy node ${node.id} references missing parent ${node.parentId}`);
    }
  }

  for (const assignment of dataset.accountAssignments) {
    if (!accountIds.has(assignment.accountId)) {
      issues.push(`Assignment ${assignment.id} references missing account ${assignment.accountId}`);
    }

    if (!hierarchyIds.has(assignment.hierarchyNodeId)) {
      issues.push(
        `Assignment ${assignment.id} references missing hierarchy node ${assignment.hierarchyNodeId}`,
      );
    }
  }

  for (const event of dataset.externalEvents) {
    if (!accountIds.has(event.accountId)) {
      issues.push(`Event ${event.id} references missing account ${event.accountId}`);
    }

    if (!evaluationEventIds.has(event.id)) {
      issues.push(`Event ${event.id} has no relevance evaluation`);
    }

    if (containsProhibitedIntentClaim(event.externalFact)) {
      issues.push(`Event ${event.id} external fact contains prohibited intent or ownership claim`);
    }
  }

  for (const evaluation of dataset.relevanceEvaluations) {
    if (!eventIds.has(evaluation.eventId)) {
      issues.push(`Evaluation ${evaluation.id} references missing event ${evaluation.eventId}`);
    }

    const visibleEvaluationFields = [
      ["generalRedHatRelevance", evaluation.generalRedHatRelevance],
      ["accountSpecificRelevance", evaluation.accountSpecificRelevance],
      ["validationAction", evaluation.validationAction],
      ["rationale", evaluation.rationale],
    ] as const;

    for (const [fieldName, value] of visibleEvaluationFields) {
      if (value && containsProhibitedIntentClaim(value)) {
        issues.push(`Evaluation ${evaluation.id} ${fieldName} contains prohibited overclaim`);
      }
    }
  }

  return issues;
}

export function containsProhibitedIntentClaim(value: string): boolean {
  const normalized = value.toLowerCase();
  return prohibitedIntentClaims.some((claim) => normalized.includes(claim));
}
