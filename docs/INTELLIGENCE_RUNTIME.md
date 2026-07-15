# V2 Intelligence Runtime

The V2 runtime is the authoritative FastAPI path for account-agnostic external research. It runs alongside the Node V1 monitor while migration is in progress. The runtimes do not share a writable intelligence database.

## Runtime path

```text
account context -> MaaS plan -> provider discovery -> controlled acquisition
-> normalized evidence -> entity and claim decisions -> verification
-> bounded relevance -> Account Signal Brief -> feedback and replay records
```

Tavily direct API, Tavily MCP, and Brave are separate provider paths with independent readiness, operation names, raw artifacts, latency records, and downstream yield metrics. The selection policy prefers Tavily direct API, then Tavily MCP, then Brave when each capability is available.

Provider snippets and tool results are not evidence. Only normalized acquired content can support a claim, citation, verification decision, or seller-visible signal.

## Local setup

Install the pinned runtime once:

```powershell
winget install --id astral-sh.uv --exact
uv python install 3.12
uv --directory intelligence sync --all-groups
```

Put local values only in the ignored `.env`. Required variable names are documented in `.env.example`:

- `CM_MAAS_BASE_URL`
- `CM_MAAS_API_KEY`
- `CM_MAAS_MODEL`
- `CM_TAVILY_API_KEY`
- `CM_TAVILY_MCP_URL`
- `CM_TAVILY_MCP_TOKEN`
- `CM_BRAVE_SEARCH_API_KEY`

Never commit or document secret values, bearer tokens, or authenticated MCP URLs.

Start the runtime and supporting services:

```powershell
docker compose -f compose.intelligence.yml up -d --build
```

The API health endpoint is `http://127.0.0.1:8000/health`. Capability readiness is available at `http://127.0.0.1:8000/v2/capabilities`.

Start the shared frontend separately:

```powershell
npm run build
npm start
```

Open `http://127.0.0.1:8787/research` for the V2 research workspace. V1 remains at `http://127.0.0.1:8787/`.

## Persistence and observability

PostgreSQL stores runs, stage outputs, discovery records, evidence, claims, decisions, feedback, outcomes, policy versions, and replay manifests. MinIO stores immutable raw provider, source, MaaS request, and MaaS response artifacts. Temporal owns durable asynchronous execution and bounded continuation.

The runtime records provider, model, prompt and schema version, request and response references, tool calls, token usage where available, latency, cost where available, validation results, failures, retries, and downstream decision impact.

The local runtime uses pgvector-backed embeddings for provenance-aware memory. Advanced learning policies remain inactive until replay evaluation has sufficient data. Feedback is collected for evaluation and does not automatically retrain or modify the system.

## Current capability state

The implementation currently supports:

- real MaaS reasoning calls;
- Tavily direct API search and extract when configured;
- Tavily MCP search and extract, with crawl and map declared where available;
- Brave Web and News Search connectors, currently unavailable when the local Brave key is absent;
- controlled HTML, PDF, and browser acquisition;
- persisted evidence-to-brief output with complete signal audit and feedback history.

## Validation

```powershell
uv --directory intelligence run ruff check .
uv --directory intelligence run pytest
npm run check
```

Use the direct Tavily API first for live acceptance when configured. If it is unavailable, the runtime can fall back to Tavily MCP or Brave while preserving provider provenance and downstream yield metrics. Do not use imported JSON or RSS-only input as a substitute for autonomous research.
