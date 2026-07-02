# External Account Signal Monitor

A local foundation for prioritizing external account events through a bounded Red Hat relevance lens.

## First milestone

`Hierarchy scope -> prioritized accounts -> account detail -> evidence -> relevance hypothesis -> validation action`

The first build uses synthetic local fixtures only. It does not include live retrieval, APIs, RAG, MCP, Salesforce, internal Red Hat data, or notifications.

## Repository map

- `AGENTS.md` # durable coding rules and document routing for Codex.
- `docs/PRODUCT.md` # product intent and required behavior.
- `docs/ARCHITECTURE.md` # modular boundaries and future extension model.
- `docs/DATA_CONTRACTS.md` # canonical data contracts.
- `docs/plans/FOUNDATION_V0.md` # active implementation plan.
- `fixtures/` # synthetic local data only.

## Start with Codex

Open this folder locally, then ask Codex:

```text
Read AGENTS.md. Build Foundation v0 using docs/plans/FOUNDATION_V0.md. Use only local synthetic fixtures. Before coding, state the implementation sequence and any stack choice that differs from the preferred approach in the plan.
```

## Data boundary

Do not commit raw account, territory, transcript, spreadsheet, customer, credential, or internal Red Hat material. Keep source interpretation in `docs/SOURCE_BOUNDARIES.md` and use synthetic fixtures until an approved data path exists.
