# Architecture

## Design rule

Core product behavior depends on domain contracts and capability boundaries, not on one provider, model, storage engine, or delivery surface.

## Runtime topology

```text
React and TypeScript seller workspace :8787
        |
        v
FastAPI intelligence API :8000
        |
        +--> Temporal and intelligence worker
        +--> PostgreSQL and pgvector
        +--> MinIO-compatible artifact storage
        +--> Red Hat MaaS reasoning
        +--> Tavily direct API, Tavily MCP, Brave discovery
        +--> controlled HTML, PDF, and browser acquisition
```

The Node server and SQLite persistence remain V1 compatibility infrastructure. V2 uses an independent FastAPI and PostgreSQL boundary while migration is in progress. The frontend talks to FastAPI APIs through the application client and does not access providers, Temporal, PostgreSQL, or artifacts directly.

## V1 compatibility runtime

Connected Monitor v1 provides:

- local Node HTTP serving;
- runtime account and source registration;
- SQLite persistence;
- bounded RSS/Atom retrieval;
- public-source safety checks;
- optional evaluator configuration;
- account detail and monitor history views.

Manual source registration is a bootstrap and compatibility path. RSS/Atom is not the universal retrieval architecture.

## V2 intelligence runtime

The current V2 path is:

```text
account context
  -> persisted research run
  -> plan and query strategy through MaaS
  -> policy-selected discovery
  -> raw discovery result retention
  -> controlled acquisition and rendering
  -> normalized evidence and citation
  -> entity and claim decisions
  -> verification and decision trace
  -> ranking and keep/watch/reject/abstain disposition
  -> bounded relevance hypothesis and validation question
  -> Account Signal Brief and complete ledger
  -> versioned account-team feedback
```

Discovery results and provider snippets are leads only. They cannot become evidence or seller-visible signals until source content is acquired, normalized, cited, and validated.

## Capability boundaries

| Capability | Current implementation | Boundary |
|---|---|---|
| Reasoning | Red Hat MaaS through an OpenAI-compatible endpoint | Prompts, schemas, model calls, latency, usage, and validation are instrumented. |
| Discovery | Tavily direct API, Tavily MCP, Brave Web and News | Each path has independent readiness, operation names, raw results, provenance, and yield metrics. |
| Acquisition | Application-controlled HTML, PDF, and browser paths | Discovery snippets never become evidence. Private and unsafe targets are rejected. |
| Persistence | PostgreSQL for V2, SQLite for V1 | V1 and V2 do not share a writable intelligence database. |
| Orchestration | Temporal and a dedicated intelligence worker | Stage state, retries, artifacts, and failures are persisted. |
| Seller delivery | React/TypeScript research workspace | Brief, ledger, evidence audit, uncertainty, and feedback are exposed progressively. |

## Evidence and decision boundaries

- External fact, source evidence, entity match, verification, Red Hat relevance hypothesis, validation action, uncertainty, and disposition remain separate records.
- Provider metadata preserves query, rank, timestamp, provider path, operation, and raw artifact references.
- Unsupported customer intent, demand, fit, opportunity, renewal, deployment, ownership, or complete coverage claims are prohibited.
- Rejected and abstained candidates remain available for audit and evaluation but are not promoted as top signals.
- Feedback revisions are append-only. Feedback is collected for evaluation and does not automatically retrain or alter the runtime.

## Current limitations

- Provider readiness depends on local configuration. The current local capability report has MaaS and Tavily available, Brave unavailable, and HTML/PDF/browser acquisition available.
- The runtime is local and single-user, not a deployed enterprise service.
- Advanced learning and policy promotion records exist, but automatic retraining is not enabled.
- V1 and V2 coexist during migration. The long-term direction is one coherent intelligence product, not two permanent overlapping backends.
- Salesforce, Slack, email, scheduling, portfolio prioritization, and complete external-world coverage are not implemented.

## Contributor entry points

| Need | Start here |
|---|---|
| V1 server and ingestion | `server/` |
| V2 API and orchestration | `intelligence/src/connected_monitor_intelligence/` |
| V2 runtime setup | `docs/INTELLIGENCE_RUNTIME.md` |
| Seller research workspace | `src/ui/AutonomousResearchPage.tsx` |
| API contracts | `src/services/intelligenceApi.ts` and `docs/DATA_CONTRACTS.md` |
| Provider boundaries | `docs/SOURCE_BOUNDARIES.md` and the intelligence provider modules |
