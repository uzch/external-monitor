import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { z } from "zod";
import {
  CreateAccountRequest,
  CreateSourceRegistrationRequest,
  HealthDto,
  UpdateAccountRequest,
  UpdateSourceRegistrationRequest,
} from "../src/domain/connectedContracts.js";
import { RuntimeConfig, evaluatorConfigured, loadSeedAccounts } from "./config.js";
import { createSemanticEvaluator } from "./evaluator.js";
import { MonitorRunner } from "./monitorRunner.js";
import { ConnectedRepositories } from "./repositories.js";
import { RssAtomConnector } from "./rssAtomConnector.js";

const accountSchema = z.object({
  name: z.string().min(1),
  aliases: z.array(z.string().min(1)).default([]),
  sector: z.string().optional(),
  geography: z.string().optional(),
  hierarchyLabel: z.string().optional(),
  hierarchyPath: z.array(z.string().min(1)).optional(),
  mappingStatus: z.enum(["illustrative", "partial_validated", "validated"]).optional(),
});

const accountPatchSchema = accountSchema.partial().extend({
  status: z.enum(["active", "inactive", "archived"]).optional(),
});

const sourceSchema = z.object({
  accountId: z.string().min(1),
  displayName: z.string().min(1),
  url: z.string().url().refine((value) => ["http:", "https:"].includes(new URL(value).protocol), {
    message: "Source URL must use http or https",
  }).refine((value) => !new URL(value).username && !new URL(value).password, {
    message: "Source URL must not include credentials",
  }),
  policy: z.object({
    minIntervalMinutes: z.number().int().min(0).optional(),
    timeoutMs: z.number().int().min(1000).max(30000).optional(),
    maxEntriesPerRun: z.number().int().min(1).max(100).optional(),
    maxResponseBytes: z.number().int().min(1024).max(5_000_000).optional(),
  }).optional(),
});

const sourcePatchSchema = sourceSchema.omit({ accountId: true }).partial().extend({
  state: z.enum(["active", "inactive", "archived"]).optional(),
});

const contentTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

export function createConnectedServer(config: RuntimeConfig, repositories: ConnectedRepositories) {
  seedRuntimeData(config, repositories);

  const evaluator = createSemanticEvaluator(config);
  const runner = new MonitorRunner(repositories, new RssAtomConnector(), evaluator);
  const distRoot = resolve(process.cwd(), "dist");

  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);

      if (url.pathname.startsWith("/api/")) {
        await handleApi(request, response, url, config, repositories, runner);
        return;
      }

      await serveStatic(response, distRoot, url.pathname);
    } catch (error) {
      sendJson(response, 500, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
}

async function handleApi(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  config: RuntimeConfig,
  repositories: ConnectedRepositories,
  runner: MonitorRunner,
) {
  const method = request.method ?? "GET";

  if (method === "GET" && url.pathname === "/api/health") {
    const health: HealthDto = {
      status: evaluatorConfigured(config) ? "ok" : "degraded",
      storage: "available",
      sourceConnector: "rss_atom",
      evaluator: evaluatorConfigured(config) ? "configured" : "unconfigured",
      warnings: evaluatorConfigured(config)
        ? []
        : ["Semantic evaluator is not configured. Retrieved candidates remain awaiting evaluation."],
    };
    sendJson(response, 200, health);
    return;
  }

  if (method === "GET" && url.pathname === "/api/accounts") {
    sendJson(response, 200, repositories.accounts.listAccounts(true));
    return;
  }

  if (method === "POST" && url.pathname === "/api/accounts") {
    const body = accountSchema.parse(await readJson(request)) as CreateAccountRequest;
    sendJson(response, 201, repositories.accounts.createAccount(body));
    return;
  }

  const accountMatch = /^\/api\/accounts\/([^/]+)$/.exec(url.pathname);
  if (accountMatch && method === "GET") {
    const detail = repositories.rankings.getAccountDetail(accountMatch[1]);
    if (!detail) {
      sendJson(response, 404, { error: "Account not found" });
      return;
    }
    sendJson(response, 200, detail);
    return;
  }

  if (accountMatch && method === "PATCH") {
    const body = accountPatchSchema.parse(await readJson(request)) as UpdateAccountRequest;
    const account = repositories.accounts.updateAccount(accountMatch[1], body);
    sendJson(response, account ? 200 : 404, account ?? { error: "Account not found" });
    return;
  }

  if (method === "GET" && url.pathname === "/api/source-registrations") {
    const accountId = url.searchParams.get("accountId") ?? undefined;
    sendJson(response, 200, repositories.accounts.listSourceRegistrations(accountId, true));
    return;
  }

  if (method === "POST" && url.pathname === "/api/source-registrations") {
    const body = sourceSchema.parse(await readJson(request)) as CreateSourceRegistrationRequest;
    if (!repositories.accounts.getAccount(body.accountId)) {
      sendJson(response, 400, { error: "Source registration references an unknown account" });
      return;
    }
    sendJson(response, 201, repositories.accounts.createSourceRegistration(body));
    return;
  }

  const sourceMatch = /^\/api\/source-registrations\/([^/]+)$/.exec(url.pathname);
  if (sourceMatch && method === "PATCH") {
    const body = sourcePatchSchema.parse(await readJson(request)) as UpdateSourceRegistrationRequest;
    const source = repositories.accounts.updateSourceRegistration(sourceMatch[1], body);
    sendJson(response, source ? 200 : 404, source ?? { error: "Source registration not found" });
    return;
  }

  if (method === "GET" && url.pathname === "/api/scopes") {
    const scopes = Array.from(
      new Map(repositories.accounts.listAccounts().map((account) => [
        account.hierarchyNodeId,
        {
          id: account.hierarchyNodeId,
          label: account.hierarchyLabel,
          pathLabel: account.hierarchyPath.join(" / "),
        },
      ])).values(),
    );
    sendJson(response, 200, scopes);
    return;
  }

  if (method === "GET" && url.pathname === "/api/portfolio") {
    sendJson(response, 200, {
      accounts: repositories.rankings.latestAccountSummaries(),
      coverageNotice:
        "Connected Monitor v1 monitors active registered sources only. It does not claim full external-world coverage.",
      latestRun: repositories.runs.listRuns(1)[0],
    });
    return;
  }

  if (method === "POST" && url.pathname === "/api/monitor-runs") {
    const body = (await readJsonOptional(request)) as { accountId?: string };
    const run = await runner.run(body?.accountId);
    sendJson(response, 201, run);
    return;
  }

  if (method === "GET" && url.pathname === "/api/monitor-runs") {
    sendJson(response, 200, repositories.runs.listRuns(25));
    return;
  }

  const runMatch = /^\/api\/monitor-runs\/([^/]+)$/.exec(url.pathname);
  if (runMatch && method === "GET") {
    const run = repositories.runs.getRun(runMatch[1]);
    if (!run) {
      sendJson(response, 404, { error: "Monitor run not found" });
      return;
    }
    sendJson(response, 200, {
      run,
      sourceDiagnostics: repositories.runs.listSourceDiagnostics(run.id),
      candidates: repositories.candidates.listCandidatesForRun(run.id),
      evaluations: repositories.evaluations.listEvaluationsForRun(run.id),
    });
    return;
  }

  sendJson(response, 404, { error: "Not found" });
}

function seedRuntimeData(config: RuntimeConfig, repositories: ConnectedRepositories) {
  const seeds = loadSeedAccounts(config);
  if (seeds.length === 0 || repositories.accounts.listAccounts(true).length > 0) {
    return;
  }

  for (const seed of seeds) {
    const account = repositories.accounts.createAccount(seed);
    for (const source of seed.sources) {
      repositories.accounts.createSourceRegistration({ ...source, accountId: account.id });
    }
  }
}

async function serveStatic(response: ServerResponse, distRoot: string, pathname: string) {
  const filePath = await resolveRequestPath(distRoot, pathname);
  const body = await readFile(filePath);
  response.writeHead(200, {
    "Content-Type": contentTypes[extname(filePath)] ?? "application/octet-stream",
  });
  response.end(body);
}

async function resolveRequestPath(distRoot: string, pathname: string): Promise<string> {
  const relativePath = pathname === "/" ? "index.html" : decodeURIComponent(pathname.slice(1));
  const candidate = resolve(distRoot, relativePath);
  const rootPrefix = distRoot.endsWith(sep) ? distRoot : `${distRoot}${sep}`;

  if (candidate !== distRoot && !candidate.startsWith(rootPrefix)) {
    throw new Error("Request path escapes dist root");
  }

  try {
    const stats = await stat(candidate);
    if (stats.isFile()) {
      return candidate;
    }
  } catch {
    return resolve(distRoot, "index.html");
  }

  return resolve(distRoot, "index.html");
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

async function readJsonOptional(request: IncomingMessage): Promise<unknown | undefined> {
  const body = await readJson(request);
  return Object.keys(body as object).length ? body : undefined;
}

function sendJson(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(body));
}
