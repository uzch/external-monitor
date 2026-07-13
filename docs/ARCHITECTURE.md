# Architecture

## Design rule
Core product behavior depends on domain contracts and provider interfaces, never on a spreadsheet, API, model, CRM, or delivery surface.

## Domain flow

`providers -> validation -> event/evidence records -> relevance evaluation -> prioritization -> portfolio/account application services -> UI`

## Required modules

| Module | Foundation v0 | Replaceable future path |
|---|---|---|
| hierarchy provider | local hierarchy fixtures | territory or CRM source |
| account + assignment provider | local account/mapping fixtures | authoritative account source |
| event provider | local normalized events | search, news, RSS, procurement, API connector |
| capability provider | local Red Hat capability taxonomy | approved taxonomy/knowledge source |
| relevance evaluator | deterministic fixture result or rules | model, RAG, MCP, internal-context enrichment |
| prioritization service | deterministic ranking | configurable scoring/feedback service |
| portfolio service | scope/filter/aggregate mapped accounts | same service with authoritative data |
| presentation adapter | local web UI | Salesforce, Slack, email, other surfaces |
| audit service | retain validation/evaluation metadata | human-review and override workflow |

## Boundary rules
- UI does not read fixture files directly.
- Event providers do not decide relevance.
- Relevance evaluators do not fetch external data.
- Delivery does not alter evidence or ranking.
- Public evidence, internal context, generated interpretation, and seller action remain distinct records.
- Unknown data remains unknown; no inferred ownership or missing-data fabrication.

## Connected Monitor v1 implementation
Connected Monitor v1 adds a local Node HTTP server, local SQLite repositories, runtime account and source registration APIs, a bounded RSS/Atom connector, source-safety checks, optional evaluator configuration, and ranking snapshots over evaluated evidence-backed records.
Manual registration is an administrative bootstrap path for local operation and testing, not the intended long-term discovery experience.
Future intelligent discovery, feedback learning, and agentic prioritization should be implemented through replaceable adapters and review workflows rather than coupling the UI directly to retrieval, model, or storage details.

## Current capability-proving iteration

Implemented in this validated checkpoint:

- Real Red Hat Demo Platform MaaS connectivity through a configured OpenAI-compatible Chat Completions endpoint.
- Reusable MaaS probes for planning, extraction, evaluation, and verification.
- Measured four-model benchmark coverage recorded in [MAAS_MODELS.md](MAAS_MODELS.md).
- Safe application-controlled public HTML and PDF retrieval with local probes.
- Truthful UI and API capability states that expose the missing live-search dependency instead of pretending autonomous research exists.

Still absent or blocked:

- Approved live public-web search with citations.
- Real account-input to autonomous-brief orchestration.
- Autonomous entity resolution, event clustering, verification loops, and seller-grade brief generation.
- A backend-first autonomous runtime. The likely next implementation path is FastAPI, but that migration has not started in this checkpoint.

Structured-output limits:

- Structured-output compatibility is model-specific and not yet repeatable enough to treat MaaS as autonomous-runtime-ready.
- `gpt-oss-120b` succeeded in an isolated full probe but was not stable across the sequential benchmark.
- `llama-scout-17b` and `gpt-oss-20b` showed partial promise with schema and rate-limit failures.
- `deepseek-r1-distill-qwen-14b` did not satisfy the required structured-output contract in the measured run.

Frontend status:

- Seller-facing UI work is frozen except for wiring real backend states and outputs.
- Do not start a broader UI redesign, portfolio shell rebuild, or seller-experience expansion before the autonomous backend path is real.

## Next Session Starting Point

Read this file first, then [MAAS_MODELS.md](MAAS_MODELS.md).

Run:

```bash
npm run check
```

Rerun the MaaS or retrieval probes only when provider configuration, model integration, or the relevant retrieval and reasoning code changes.

Then continue the backend-first, living-intelligence phase:

1. Reuse the existing MaaS and retrieval probes as the first provider implementations.
2. Start the account-agnostic autonomous runtime behind backend APIs first, with FastAPI as the intended next runtime direction rather than a permanent architectural limit.
3. Preserve the frontend freeze except for wiring real backend states and outputs.
4. Treat live public-web search with citations as a required capability for full autonomy and pursue it in parallel rather than using it as a reason to postpone backend intelligence work.

## Preferred implementation posture
Foundation v0 is a single-user local web application. Preferred stack: TypeScript, React, Vite, a lightweight router, schema validation, unit tests, and one browser-flow test. Codex may choose an alternative only when it materially improves simplicity or testability; record the reason in `docs/decisions/`.

## Future integration contract
Each external capability is added as an adapter that implements an existing provider interface. Adding RAG, MCP, APIs, Salesforce, a model provider, or notifications must not require changes to core entities or portfolio/account application-service contracts.
