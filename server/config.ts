import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { z } from "zod";
import {
  CreateAccountRequest,
  CreateSourceRegistrationRequest,
  SourcePolicy,
} from "../src/domain/connectedContracts.js";

const defaultPolicy: SourcePolicy = {
  minIntervalMinutes: 30,
  timeoutMs: 8000,
  maxEntriesPerRun: 25,
  maxResponseBytes: 1_000_000,
};

const seedConfigSchema = z.object({
  accounts: z.array(z.object({
    name: z.string().min(1),
    aliases: z.array(z.string().min(1)).default([]),
    sector: z.string().optional(),
    geography: z.string().optional(),
    hierarchyLabel: z.string().optional(),
    hierarchyPath: z.array(z.string().min(1)).optional(),
    mappingStatus: z.enum(["illustrative", "partial_validated", "validated"]).optional(),
    sources: z.array(z.object({
      displayName: z.string().min(1),
      url: z.string().url(),
      policy: z.object({
        minIntervalMinutes: z.number().int().min(0).optional(),
        timeoutMs: z.number().int().min(1000).max(30000).optional(),
        maxEntriesPerRun: z.number().int().min(1).max(100).optional(),
        maxResponseBytes: z.number().int().min(1024).max(5_000_000).optional(),
      }).optional(),
    })).default([]),
  })).default([]),
});

export interface SeedAccount extends CreateAccountRequest {
  sources: Omit<CreateSourceRegistrationRequest, "accountId">[];
}

export interface RuntimeConfig {
  port: number;
  databasePath: string;
  seedConfigPath?: string;
  defaultSourcePolicy: SourcePolicy;
  evaluator: {
    baseUrl?: string;
    apiKey?: string;
    model?: string;
    timeoutMs: number;
  };
}

export function loadRuntimeConfig(env = process.env): RuntimeConfig {
  const databasePath = resolve(env.CM_DATABASE_PATH ?? "local-data/connected-monitor.sqlite");
  mkdirSync(dirname(databasePath), { recursive: true });

  return {
    port: Number(env.CM_PORT ?? 8787),
    databasePath,
    seedConfigPath: env.CM_SEED_CONFIG_PATH ? resolve(env.CM_SEED_CONFIG_PATH) : undefined,
    defaultSourcePolicy: {
      minIntervalMinutes: numberEnv(env.CM_SOURCE_MIN_INTERVAL_MINUTES, defaultPolicy.minIntervalMinutes),
      timeoutMs: numberEnv(env.CM_SOURCE_TIMEOUT_MS, defaultPolicy.timeoutMs),
      maxEntriesPerRun: numberEnv(env.CM_SOURCE_MAX_ENTRIES, defaultPolicy.maxEntriesPerRun),
      maxResponseBytes: numberEnv(env.CM_SOURCE_MAX_RESPONSE_BYTES, defaultPolicy.maxResponseBytes),
    },
    evaluator: {
      baseUrl: env.CM_EVALUATOR_BASE_URL,
      apiKey: env.CM_EVALUATOR_API_KEY,
      model: env.CM_EVALUATOR_MODEL,
      timeoutMs: numberEnv(env.CM_EVALUATOR_TIMEOUT_MS, 15000),
    },
  };
}

export function loadSeedAccounts(config: RuntimeConfig): SeedAccount[] {
  if (!config.seedConfigPath) {
    return [];
  }

  const parsed = seedConfigSchema.parse(JSON.parse(readFileSync(config.seedConfigPath, "utf8")));
  return parsed.accounts.map((account) => ({
    ...account,
    sources: account.sources.map((source) => ({
      displayName: source.displayName,
      url: source.url,
      policy: source.policy,
    })),
  }));
}

export function evaluatorConfigured(config: RuntimeConfig): boolean {
  return Boolean(config.evaluator.baseUrl && config.evaluator.apiKey && config.evaluator.model);
}

function numberEnv(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
