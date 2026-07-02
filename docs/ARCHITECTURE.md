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

## Preferred implementation posture
Foundation v0 is a single-user local web application. Preferred stack: TypeScript, React, Vite, a lightweight router, schema validation, unit tests, and one browser-flow test. Codex may choose an alternative only when it materially improves simplicity or testability; record the reason in `docs/decisions/`.

## Future integration contract
Each external capability is added as an adapter that implements an existing provider interface. Adding RAG, MCP, APIs, Salesforce, a model provider, or notifications must not require changes to core entities or portfolio/account application-service contracts.
