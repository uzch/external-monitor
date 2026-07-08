import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  CandidateEventRecord,
  EvaluationRecord,
  MonitoredAccount,
} from "../src/domain/connectedContracts.js";
import { approvedCapabilityIds, approvedCapabilityTaxonomy } from "./capabilityTaxonomy.js";
import { RuntimeConfig } from "./config.js";

export const evaluationPolicyVersion = "connected-v1-evidence-bound-2026-07-07";

const evaluatorOutputSchema = z.object({
  state: z.enum(["evaluated", "abstained"]),
  accountMatchBasis: z.string().min(1),
  externalFact: z.string().min(1).optional(),
  evidenceReference: z.string().min(1).optional(),
  selectedCapabilityIds: z.array(z.string().min(1)).default([]),
  relevanceHypothesis: z.string().min(1).optional(),
  uncertainty: z.string().min(1),
  abstentionReason: z.string().min(1).optional(),
  validationAction: z.string().min(1).optional(),
  factorScores: z.record(z.number().finite()).default({}),
  semanticPriorityScore: z.number().finite().min(0).max(100).optional(),
});

export interface SemanticEvaluator {
  isConfigured(): boolean;
  evaluate(candidate: CandidateEventRecord, account: MonitoredAccount): Promise<EvaluationRecord>;
}

export interface ModelClient {
  completeJson(input: ModelEvaluationInput): Promise<unknown>;
}

export interface ModelEvaluationInput {
  system: string;
  candidate: {
    title: string;
    publicationDate: string;
    canonicalUrl: string;
    excerpt: string;
    contentFingerprint: string;
    accountMatchBasis: string;
  };
  account: {
    name: string;
    aliases: string[];
    sector?: string;
    geography?: string;
  };
  outputSchema: string[];
}

export class OptionalSemanticEvaluator implements SemanticEvaluator {
  constructor(private readonly modelClient?: ModelClient) {}

  isConfigured(): boolean {
    return Boolean(this.modelClient);
  }

  async evaluate(candidate: CandidateEventRecord, account: MonitoredAccount): Promise<EvaluationRecord> {
    if (!this.modelClient) {
      throw new Error("Semantic evaluator is not configured");
    }

    try {
      const raw = await this.modelClient.completeJson({
        system:
          "Evaluate public evidence for possible general Red Hat relevance. Stay evidence-bound. " +
          "Never infer customer intent, demand, fit, deployment, renewal, ownership, or complete coverage. " +
          "Return abstained when the evidence is insufficient. Use only selected capability IDs that are explicit in the approved taxonomy supplied by the application.",
        candidate: {
          title: candidate.title,
          publicationDate: candidate.publicationDate,
          canonicalUrl: candidate.canonicalUrl,
          excerpt: candidate.excerpt,
          contentFingerprint: candidate.contentFingerprint,
          accountMatchBasis: candidate.accountMatchBasis,
        },
        account: {
          name: account.name,
          aliases: account.aliases,
          sector: account.sector,
          geography: account.geography,
        },
        outputSchema: [
          `approvedCapabilityIds: ${approvedCapabilityTaxonomy.map((entry) => entry.id).join(", ")}`,
          "state: evaluated | abstained",
          "accountMatchBasis",
          "externalFact",
          "evidenceReference",
          "selectedCapabilityIds",
          "relevanceHypothesis",
          "uncertainty",
          "abstentionReason",
          "validationAction",
          "factorScores",
          "semanticPriorityScore",
        ],
      });
      const parsed = evaluatorOutputSchema.parse(raw);

      const invalidCapabilityId = parsed.selectedCapabilityIds.find(
        (capabilityId) => !approvedCapabilityIds.has(capabilityId),
      );
      if (invalidCapabilityId) {
        return failedEvaluation(candidate, `Evaluator selected unapproved capability ID ${invalidCapabilityId}`);
      }

      if (parsed.state === "evaluated" && (!parsed.relevanceHypothesis || !parsed.validationAction)) {
        return failedEvaluation(candidate, "Evaluator returned evaluated without relevance hypothesis and validation action");
      }

      return {
        id: randomUUID(),
        candidateId: candidate.id,
        runId: candidate.runId,
        accountId: candidate.accountId,
        state: parsed.state,
        evaluatorName: "configured-http-model",
        evaluatorVersion: "1",
        evaluationPolicyVersion,
        accountMatchBasis: parsed.accountMatchBasis,
        externalFact: parsed.externalFact,
        evidenceReference: parsed.evidenceReference ?? candidate.canonicalUrl,
        selectedCapabilityIds: parsed.selectedCapabilityIds,
        relevanceHypothesis: parsed.state === "evaluated" ? parsed.relevanceHypothesis : undefined,
        uncertainty: parsed.uncertainty,
        abstentionReason: parsed.state === "abstained" ? parsed.abstentionReason ?? "Evaluator abstained" : undefined,
        validationAction: parsed.state === "evaluated" ? parsed.validationAction : undefined,
        factorScores: parsed.factorScores,
        semanticPriorityScore: parsed.state === "evaluated" ? parsed.semanticPriorityScore ?? 0 : undefined,
        evaluatedAt: new Date().toISOString(),
      };
    } catch (error) {
      return failedEvaluation(candidate, error instanceof Error ? error.message : String(error));
    }
  }
}

export class ConfiguredHttpModelClient implements ModelClient {
  constructor(private readonly config: RuntimeConfig["evaluator"]) {}

  async completeJson(input: ModelEvaluationInput): Promise<unknown> {
    if (!this.config.baseUrl || !this.config.apiKey || !this.config.model) {
      throw new Error("Model client is missing endpoint, API key, or model");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(this.config.baseUrl, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          input,
          response_format: { type: "json_object" },
        }),
      });

      if (!response.ok) {
        throw new Error(`Model endpoint returned HTTP ${response.status}`);
      }

      const json = await response.json();
      return extractJsonPayload(json);
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function createSemanticEvaluator(config: RuntimeConfig): SemanticEvaluator {
  if (!config.evaluator.baseUrl || !config.evaluator.apiKey || !config.evaluator.model) {
    return new OptionalSemanticEvaluator();
  }

  return new OptionalSemanticEvaluator(new ConfiguredHttpModelClient(config.evaluator));
}

function extractJsonPayload(json: unknown): unknown {
  if (typeof json === "object" && json !== null) {
    const record = json as Record<string, unknown>;
    if (typeof record.output_text === "string") {
      return JSON.parse(record.output_text);
    }
    const choices = record.choices;
    if (Array.isArray(choices)) {
      const content = (choices[0] as { message?: { content?: unknown } } | undefined)?.message?.content;
      if (typeof content === "string") {
        return JSON.parse(content);
      }
    }
  }

  return json;
}

function failedEvaluation(candidate: CandidateEventRecord, message: string): EvaluationRecord {
  return {
    id: randomUUID(),
    candidateId: candidate.id,
    runId: candidate.runId,
    accountId: candidate.accountId,
    state: "failed",
    evaluatorName: "configured-http-model",
    evaluatorVersion: "1",
    evaluationPolicyVersion,
    accountMatchBasis: candidate.accountMatchBasis,
    selectedCapabilityIds: [],
    factorScores: {},
    diagnostics: message,
    evaluatedAt: new Date().toISOString(),
  };
}
