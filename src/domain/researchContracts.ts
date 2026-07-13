import { z } from "zod";
import { MonitoredAccount } from "./connectedContracts.js";
import { containsProhibitedIntentClaim } from "./validation.js";

export const researchRunStates = ["imported"] as const;
export const researchImportSources = ["gpt_assisted", "manual"] as const;
export const researchSignalDispositions = ["keep", "watch", "reject", "abstain"] as const;
export const priorityTiers = ["high", "medium", "low", "none"] as const;
export const uncertaintyStates = ["low", "medium", "high", "unknown", "conflicting"] as const;
export const accountTeamFeedbackTypes = [
  "useful",
  "not_useful",
  "wrong_angle",
  "already_known",
  "needs_better_source",
  "follow_up_later",
] as const;

export type ResearchRunState = (typeof researchRunStates)[number];
export type ResearchImportSource = (typeof researchImportSources)[number];
export type ResearchSignalDisposition = (typeof researchSignalDispositions)[number];
export type PriorityTier = (typeof priorityTiers)[number];
export type UncertaintyState = (typeof uncertaintyStates)[number];
export type AccountTeamFeedbackType = (typeof accountTeamFeedbackTypes)[number];

export interface ResearchRun {
  id: string;
  accountId: string;
  state: ResearchRunState;
  importSource: ResearchImportSource;
  executiveSummary: string;
  sourcePlan: string;
  sourcesChecked: string[];
  sourceGaps: string[];
  searchQueriesUsed: string[];
  coverageLimitations: string[];
  unknownsAndGuardrails: string[];
  createdAt: string;
  updatedAt: string;
  importedAt: string;
}

export interface ResearchSignal {
  id: string;
  researchRunId: string;
  accountId: string;
  externalFact: string;
  sourceUrl: string;
  publisher: string;
  publicationDate?: string;
  retrievedAt: string;
  excerpt: string;
  accountMatchBasis: string;
  sourceCategory: string;
  disposition: ResearchSignalDisposition;
  dispositionRationale: string;
  redHatRelevanceHypothesis?: string;
  validationQuestion?: string;
  uncertaintyState: UncertaintyState;
  sortOrder: number;
  priorityTier: PriorityTier;
  createdAt: string;
}

export interface AccountTeamFeedback {
  id: string;
  researchSignalId: string;
  feedbackType: AccountTeamFeedbackType;
  notes?: string;
  createdAt: string;
}

export interface ResearchImportSignalInput {
  externalFact: string;
  sourceUrl: string;
  publisher: string;
  publicationDate?: string;
  retrievedAt?: string;
  excerpt: string;
  accountMatchBasis: string;
  sourceCategory: string;
  disposition: ResearchSignalDisposition;
  dispositionRationale: string;
  redHatRelevanceHypothesis?: string;
  validationQuestion?: string;
  uncertaintyState: UncertaintyState;
  sortOrder?: number;
  priorityTier?: PriorityTier;
}

export interface ResearchImportRequest {
  accountId: string;
  importSource?: ResearchImportSource;
  executiveSummary: string;
  sourcePlan: string;
  sourcesChecked: string[];
  sourceGaps: string[];
  searchQueriesUsed: string[];
  coverageLimitations: string[];
  unknownsAndGuardrails: string[];
  signals: ResearchImportSignalInput[];
}

export interface AccountTeamFeedbackRequest {
  feedbackType: AccountTeamFeedbackType;
  notes?: string;
}

export interface ResearchCapabilityStatus {
  reasoning: {
    available: boolean;
    provider: "maas";
    message: string;
  };
  retrieval: {
    available: boolean;
    provider: "application_controlled";
    message: string;
  };
  liveSearch: {
    available: boolean;
    message: string;
  };
}

export interface AccountSignalBriefDto {
  account: MonitoredAccount;
  latestResearchRun?: ResearchRun;
  executiveSummary: string;
  topSignalsToValidate: ResearchSignal[];
  watchItems: ResearchSignal[];
  rejectedNoise: ResearchSignal[];
  abstainedSignals: ResearchSignal[];
  evidenceTable: ResearchSignal[];
  validationQuestions: string[];
  unknownsAndGuardrails: string[];
  feedbackSummary: Record<AccountTeamFeedbackType, number>;
  feedback: AccountTeamFeedback[];
}

const boundedHypothesisPattern =
  /\b(may|might|could|appears|suggests|worth validating|hypothesis|possible|validate|whether|unknown|uncertain)\b/i;
const guardrailNegationPattern =
  /\b(do not|does not|no claim|not claim|without claiming|must not infer|no validation action)\b/i;
const overclaimTerms = [
  "customer intent",
  "intends to",
  "plans to buy",
  "will buy",
  "is a red hat customer",
  "owns red hat",
  "deployment",
  "renewal",
  "opportunity",
  "demand for red hat",
  "product fit",
];

const httpUrlSchema = z.string().url().refine((value) => {
  const url = new URL(value);
  return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password;
}, "Source URL must be public http or https and must not include credentials");

export const researchImportSignalSchema = z.object({
  externalFact: z.string().min(1),
  sourceUrl: httpUrlSchema,
  publisher: z.string().min(1),
  publicationDate: z.string().datetime({ offset: true }).optional(),
  retrievedAt: z.string().datetime({ offset: true }).optional(),
  excerpt: z.string().min(1),
  accountMatchBasis: z.string().min(1),
  sourceCategory: z.string().min(1),
  disposition: z.enum(researchSignalDispositions),
  dispositionRationale: z.string().min(1),
  redHatRelevanceHypothesis: z.string().min(1).optional(),
  validationQuestion: z.string().min(1).optional(),
  uncertaintyState: z.enum(uncertaintyStates),
  sortOrder: z.number().int().min(0).optional(),
  priorityTier: z.enum(priorityTiers).default("none"),
});

export const researchImportSchema = z.object({
  accountId: z.string().min(1),
  importSource: z.enum(researchImportSources).default("gpt_assisted"),
  executiveSummary: z.string().min(1),
  sourcePlan: z.string().min(1),
  sourcesChecked: z.array(z.string().min(1)).default([]),
  sourceGaps: z.array(z.string().min(1)).default([]),
  searchQueriesUsed: z.array(z.string().min(1)).default([]),
  coverageLimitations: z.array(z.string().min(1)).default([]),
  unknownsAndGuardrails: z.array(z.string().min(1)).min(1),
  signals: z.array(researchImportSignalSchema).min(1),
}).superRefine((input, context) => {
  validateInterpretiveText("executiveSummary", input.executiveSummary, context);
  input.unknownsAndGuardrails.forEach((guardrail, index) => {
    validateGuardrailText(`unknownsAndGuardrails.${index}`, guardrail, context);
  });
  input.signals.forEach((signal, index) => {
    validateInterpretiveText(`signals.${index}.dispositionRationale`, signal.dispositionRationale, context);

    if (signal.disposition !== "reject" && !signal.redHatRelevanceHypothesis) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["signals", index, "redHatRelevanceHypothesis"],
        message: "Non-rejected signals require a bounded Red Hat relevance hypothesis",
      });
    }

    if (signal.disposition !== "reject" && !signal.validationQuestion) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["signals", index, "validationQuestion"],
        message: "Non-rejected signals require an account-team validation question",
      });
    }

    if (signal.redHatRelevanceHypothesis) {
      validateInterpretiveText(
        `signals.${index}.redHatRelevanceHypothesis`,
        signal.redHatRelevanceHypothesis,
        context,
      );
    }

    if (signal.validationQuestion) {
      validateActionText(`signals.${index}.validationQuestion`, signal.validationQuestion, context);
    }
  });
});

export const accountTeamFeedbackSchema = z.object({
  feedbackType: z.enum(accountTeamFeedbackTypes),
  notes: z.string().max(2000).optional(),
});

export function parseResearchImport(input: unknown): ResearchImportRequest {
  return researchImportSchema.parse(input);
}

function validateInterpretiveText(path: string, value: string, context: z.RefinementCtx) {
  if (containsProhibitedIntentClaim(value) && !isBounded(value)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: path.split("."),
      message: "Text contains an unsupported intent, opportunity, ownership, demand, renewal, deployment, or fit claim",
    });
    return;
  }

  if (containsOverclaimTerm(value) && !isBounded(value)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: path.split("."),
      message: "Text must keep Red Hat relevance as a bounded hypothesis with uncertainty",
    });
  }
}

function validateActionText(path: string, value: string, context: z.RefinementCtx) {
  if (containsOverclaimTerm(value) && !isBounded(value)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: path.split("."),
      message: "Validation or action language must be framed as a question, unknown, or validation-only next step",
    });
  }
}

function validateGuardrailText(path: string, value: string, context: z.RefinementCtx) {
  if (containsOverclaimTerm(value) && !guardrailNegationPattern.test(value) && !boundedHypothesisPattern.test(value)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: path.split("."),
      message: "Guardrail language must not introduce unsupported claims",
    });
  }
}

function isBounded(value: string): boolean {
  return boundedHypothesisPattern.test(value) || guardrailNegationPattern.test(value);
}

function containsOverclaimTerm(value: string): boolean {
  const normalized = value.toLowerCase();
  return overclaimTerms.some((term) => normalized.includes(term));
}
