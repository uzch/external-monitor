import { z } from "zod";
import { RuntimeConfig, maasConfigured } from "./config.js";

const probeDefinitions = [
  {
    id: "research_planning",
    instruction:
      "Create a concise public-web research plan for the account. Return JSON with sourcePlan, queries, and coverageLimitations.",
    input: {
      accountName: "Example Industries",
      focus: "operational modernization",
      timeframe: "last 90 days",
    },
    schema: z.object({
      sourcePlan: z.string().min(1),
      queries: z.array(z.string().min(1)).min(1),
      coverageLimitations: z.array(z.string().min(1)),
    }),
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["sourcePlan", "queries", "coverageLimitations"],
      properties: {
        sourcePlan: { type: "string" },
        queries: { type: "array", items: { type: "string" } },
        coverageLimitations: { type: "array", items: { type: "string" } },
      },
    },
  },
  {
    id: "evidence_extraction",
    instruction:
      "Extract only source-backed facts. Return JSON with externalFact, excerpt, publicationDate, and uncertainty.",
    input: {
      source: {
        publisher: "Example Newsroom",
        url: "https://example.com/news/modernization",
        publicationDate: "2026-07-01",
        text: "Example Industries announced it is consolidating three operations centers into one shared services hub.",
      },
    },
    schema: z.object({
      externalFact: z.string().min(1),
      excerpt: z.string().min(1),
      publicationDate: z.string().min(1),
      uncertainty: z.string().min(1),
    }),
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["externalFact", "excerpt", "publicationDate", "uncertainty"],
      properties: {
        externalFact: { type: "string" },
        excerpt: { type: "string" },
        publicationDate: { type: "string" },
        uncertainty: { type: "string" },
      },
    },
  },
  {
    id: "signal_evaluation",
    instruction:
      "Evaluate this evidence with a bounded Red Hat lens. Return JSON with disposition, rationale, relevanceHypothesis, validationQuestion, and uncertainty. Do not claim customer intent, demand, fit, deployment, renewal, ownership, or opportunity.",
    input: {
      externalFact: "Example Industries announced it is consolidating three operations centers into one shared services hub.",
      evidenceUrl: "https://example.com/news/modernization",
    },
    schema: z.object({
      disposition: z.enum(["keep", "watch", "reject", "abstain"]),
      rationale: z.string().min(1),
      relevanceHypothesis: z.string().min(1).optional(),
      validationQuestion: z.string().min(1).optional(),
      uncertainty: z.string().min(1),
    }),
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["disposition", "rationale", "uncertainty"],
      properties: {
        disposition: { type: "string", enum: ["keep", "watch", "reject", "abstain"] },
        rationale: { type: "string" },
        relevanceHypothesis: { type: "string" },
        validationQuestion: { type: "string" },
        uncertainty: { type: "string" },
      },
    },
  },
  {
    id: "claim_verification",
    instruction:
      "Verify the proposed claim using only the evidence. Return JSON with state, rationale, and citedEvidenceIds. Mark insufficient or contradicted when the evidence does not support the claim.",
    input: {
      claim: "Example Industries announced an operations-center consolidation.",
      evidence: [
        {
          id: "evidence-1",
          text: "Example Industries announced it is consolidating three operations centers into one shared services hub.",
          url: "https://example.com/news/modernization",
        },
      ],
    },
    schema: z.object({
      state: z.enum(["supported", "insufficient", "contradicted"]),
      rationale: z.string().min(1),
      citedEvidenceIds: z.array(z.string()),
    }),
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["state", "rationale", "citedEvidenceIds"],
      properties: {
        state: { type: "string", enum: ["supported", "insufficient", "contradicted"] },
        rationale: { type: "string" },
        citedEvidenceIds: { type: "array", items: { type: "string" } },
      },
    },
  },
] as const;

export interface MaaSProbeResult {
  configured: boolean;
  model?: string;
  success: boolean;
  totalInputTokens?: number;
  totalOutputTokens?: number;
  tests: Array<{
    id: string;
    inputTokens?: number;
    latencyMs?: number;
    message?: string;
    outputTokens?: number;
    success: boolean;
  }>;
}

export interface MaaSBenchmarkModel {
  id: string;
  contextTokens: number;
  inputUsdPerMillionTokens: number;
  outputUsdPerMillionTokens: number;
  supportsToolChoice: boolean;
}

export const maasBenchmarkModels: MaaSBenchmarkModel[] = [
  {
    id: "gpt-oss-120b",
    contextTokens: 32768,
    inputUsdPerMillionTokens: 0.15,
    outputUsdPerMillionTokens: 0.6,
    supportsToolChoice: true,
  },
  {
    id: "deepseek-r1-distill-qwen-14b",
    contextTokens: 500000,
    inputUsdPerMillionTokens: 0.8,
    outputUsdPerMillionTokens: 0.8,
    supportsToolChoice: false,
  },
  {
    id: "llama-scout-17b",
    contextTokens: 400000,
    inputUsdPerMillionTokens: 1.07,
    outputUsdPerMillionTokens: 1.07,
    supportsToolChoice: false,
  },
  {
    id: "gpt-oss-20b",
    contextTokens: 32768,
    inputUsdPerMillionTokens: 0.08,
    outputUsdPerMillionTokens: 0.3,
    supportsToolChoice: true,
  },
];

export interface MaaSBenchmarkResult extends MaaSProbeResult {
  estimatedCostUsd?: number;
}

export class MaaSReasoningProvider {
  constructor(private readonly config: RuntimeConfig["maas"]) {}

  isConfigured(): boolean {
    return Boolean(this.config.baseUrl && this.config.apiKey && this.config.model);
  }

  forModel(model: string): MaaSReasoningProvider {
    return new MaaSReasoningProvider({ ...this.config, model });
  }

  async completeJson(instruction: string, input: unknown): Promise<unknown> {
    return (await this.completeJsonWithUsage(instruction, input)).output;
  }

  async completeJsonWithUsage(
    instruction: string,
    input: unknown,
    toolParameters?: Record<string, unknown>,
  ): Promise<{ output: unknown; usage?: TokenUsage }> {
    if (!this.isConfigured()) {
      throw new Error("MaaS reasoning is not configured. Set CM_MAAS_BASE_URL, CM_MAAS_API_KEY, and CM_MAAS_MODEL.");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await fetch(completionUrl(this.config.baseUrl!), {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          temperature: 0,
          ...(toolParameters
            ? {
              tools: [{
                type: "function",
                function: {
                  name: "submit_research_result",
                  description: "Submit the validated structured result for this research stage.",
                  parameters: toolParameters,
                },
              }],
              ...(supportsToolChoice(this.config.model) ? {
                tool_choice: {
                  type: "function",
                  function: { name: "submit_research_result" },
                },
              } : {}),
            }
            : { response_format: { type: "json_object" } }),
          messages: [
            {
              role: "system",
              content:
                toolParameters
                  ? "You are an evidence-bound research assistant. Call the submit_research_result function exactly once. Do not infer customer intent, opportunity, demand, fit, deployment, renewal, ownership, or complete coverage."
                  : "You are an evidence-bound research assistant. Return JSON only. Do not infer customer intent, opportunity, demand, fit, deployment, renewal, ownership, or complete coverage.",
            },
            {
              role: "user",
              content: `${instruction}\n\nInput:\n${JSON.stringify(input)}`,
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`MaaS model returned HTTP ${response.status}`);
      }

      const payload = await response.json();
      return {
        output: extractJsonPayload(payload),
        usage: extractUsage(payload),
      };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`MaaS model timed out after ${this.config.timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  async probe(): Promise<MaaSProbeResult> {
    if (!this.isConfigured()) {
      return {
        configured: false,
        success: false,
        tests: [{ id: "configuration", success: false, message: "MaaS reasoning is not configured." }],
      };
    }

    const tests: MaaSProbeResult["tests"] = [];
    for (const probe of probeDefinitions) {
      const startedAt = performance.now();
      let completion: { output: unknown; usage?: TokenUsage } | undefined;
      try {
        completion = await this.completeJsonWithUsage(probe.instruction, probe.input, probe.parameters);
        probe.schema.parse(completion.output);
        tests.push({
          id: probe.id,
          inputTokens: completion.usage?.inputTokens,
          latencyMs: Math.round(performance.now() - startedAt),
          outputTokens: completion.usage?.outputTokens,
          success: true,
        });
      } catch (error) {
        tests.push({
          id: probe.id,
          inputTokens: completion?.usage?.inputTokens,
          latencyMs: Math.round(performance.now() - startedAt),
          success: false,
          message: error instanceof Error ? error.message : String(error),
          outputTokens: completion?.usage?.outputTokens,
        });
      }
    }

    return {
      configured: true,
      model: this.config.model,
      success: tests.every((test) => test.success),
      totalInputTokens: sumTokens(tests, "inputTokens"),
      totalOutputTokens: sumTokens(tests, "outputTokens"),
      tests,
    };
  }
}

export async function benchmarkMaaSModels(config: RuntimeConfig): Promise<MaaSBenchmarkResult[]> {
  const provider = createMaaSReasoningProvider(config);
  const results: MaaSBenchmarkResult[] = [];

  for (const model of maasBenchmarkModels) {
    const probe = await provider.forModel(model.id).probe();
    const estimatedCostUsd = probe.totalInputTokens === undefined || probe.totalOutputTokens === undefined
      ? undefined
      : roundUsd(
        (probe.totalInputTokens / 1_000_000) * model.inputUsdPerMillionTokens +
        (probe.totalOutputTokens / 1_000_000) * model.outputUsdPerMillionTokens,
      );
    results.push({ ...probe, estimatedCostUsd });
  }

  return results;
}

export function createMaaSReasoningProvider(config: RuntimeConfig): MaaSReasoningProvider {
  return new MaaSReasoningProvider(config.maas);
}

export function maasReasoningConfigured(config: RuntimeConfig): boolean {
  return maasConfigured(config);
}

function completionUrl(baseUrl: string): string {
  const normalized = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return normalized.endsWith("chat/completions/")
    ? normalized.slice(0, -1)
    : new URL("chat/completions", normalized).toString();
}

function extractJsonPayload(payload: unknown): unknown {
  if (typeof payload !== "object" || payload === null) {
    throw new Error("MaaS model returned an invalid response body");
  }

  const response = payload as {
    choices?: Array<{
      message?: {
        content?: unknown;
        function_call?: { arguments?: unknown };
        tool_calls?: Array<{ function?: { arguments?: unknown } }>;
      };
    }>;
  };
  const message = response.choices?.[0]?.message;
  const argumentsText = message?.tool_calls?.[0]?.function?.arguments ?? message?.function_call?.arguments;
  const content = typeof argumentsText === "string" ? argumentsText : message?.content;
  if (typeof content !== "string") {
    throw new Error("MaaS model did not return chat-completion JSON content");
  }

  try {
    return JSON.parse(content);
  } catch {
    throw new Error("MaaS model returned content that was not valid JSON");
  }
}

interface TokenUsage {
  inputTokens?: number;
  outputTokens?: number;
}

function extractUsage(payload: unknown): TokenUsage | undefined {
  if (typeof payload !== "object" || payload === null) {
    return undefined;
  }
  const usage = (payload as { usage?: { prompt_tokens?: unknown; completion_tokens?: unknown } }).usage;
  const inputTokens = numberOrUndefined(usage?.prompt_tokens);
  const outputTokens = numberOrUndefined(usage?.completion_tokens);
  return inputTokens === undefined && outputTokens === undefined ? undefined : { inputTokens, outputTokens };
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function sumTokens(
  tests: MaaSProbeResult["tests"],
  field: "inputTokens" | "outputTokens",
): number | undefined {
  const values = tests.map((test) => test[field]).filter((value): value is number => value !== undefined);
  return values.length === 0 ? undefined : values.reduce((total, value) => total + value, 0);
}

function roundUsd(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function supportsToolChoice(model: string | undefined): boolean {
  return Boolean(maasBenchmarkModels.find((candidate) => candidate.id === model)?.supportsToolChoice);
}
