# Intelligence Runtime

The v2 intelligence runtime is the authoritative FastAPI path for autonomous account research. It is separate from the Node v1 monitor while migration is in progress. The runtimes do not share a writable database.

## Runtime Path

`account context -> MaaS plan -> Brave Web and News discovery -> controlled acquisition -> normalized evidence -> entity and event decisions -> verification -> bounded relevance -> brief -> feedback -> replay and policy evaluation`

Brave results are retained as raw discovery artifacts with query provenance, ranking position, timestamps, and provider metadata. Snippets are not evidence. Only application-acquired source content can support a claim, citation, verification, or seller-visible signal.

## Local Start

Install the pinned runtime once:

```powershell
winget install --id astral-sh.uv --exact
uv python install 3.12
uv --directory intelligence sync --all-groups
```

Add local values only to ignored `.env`. Required names are `CM_MAAS_BASE_URL`, `CM_MAAS_API_KEY`, `CM_MAAS_MODEL`, and `CM_BRAVE_SEARCH_API_KEY`. See `.env.example` for local infrastructure and safety settings.

Start the platform:

```powershell
docker compose -f compose.intelligence.yml up -d --build
```

The FastAPI health endpoint is `http://127.0.0.1:8000/health`. A research run cannot start unless both MaaS and Brave discovery are configured. This fail-closed state is deliberate.

## Persistence and Learning

PostgreSQL stores run state, task outputs, discovery records, evidence, claims, decisions, feedback, outcomes, policy versions, and replay manifests. MinIO stores immutable raw provider, source, MaaS request, and MaaS response artifacts. Temporal owns durable asynchronous execution and bounded replanning.

The runtime uses a pinned local BGE embedding model for 384-dimensional vector memory. PostgreSQL graph edges represent account-to-event relationships with evidence provenance. Memory retrieval is account-scoped, salience-aware, and provenance-backed.

Feedback and outcomes create append-only learning records. Candidate policies require replay evaluation before promotion. Promotion is versioned and rollback restores the recorded predecessor. Advanced learning methods remain inactive until sufficient evaluated data exists.

## Validation

```powershell
uv --directory intelligence run ruff check .
uv --directory intelligence run pytest
npm run check
```

Live acceptance additionally requires a configured Brave key and a real run that reaches the evidence-backed brief through both MaaS and system-owned retrieval.
