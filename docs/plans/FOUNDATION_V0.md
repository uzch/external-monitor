# Foundation v0 Plan

## Outcome
A local working application that proves:

`select mapped scope -> see ranked accounts -> open account -> inspect evidence -> understand relevance hypothesis -> see validation action`

## Boundary
Use synthetic local fixtures only. No network calls, credentials, live sources, RAG, MCP, Salesforce, internal Red Hat data, notifications, or production ownership claims.

## Implementation sequence
1. Inspect `AGENTS.md`, `PRODUCT.md`, `ARCHITECTURE.md`, and `DATA_CONTRACTS.md`.
2. Select or confirm the preferred local stack; record any material deviation in `docs/decisions/`.
3. Scaffold the application, formatting, test runner, and one browser-flow test setup.
4. Implement typed domain contracts and fixture-provider interfaces.
5. Create synthetic fixtures that cover required scenarios in `fixtures/README.md`.
6. Implement validation, deterministic relevance/evaluation loading, and portfolio ranking services.
7. Build portfolio scope/filter/ranking UI.
8. Build account detail UI with Account Pulse and signal evidence.
9. Add empty, invalid-data, and incomplete-mapping states.
10. Run all checks; update README with actual local commands.

## Minimum UI

### Portfolio
- Scope selection across available hierarchy nodes.
- Ranked mapped accounts.
- Account name, hierarchy path, highest priority, latest qualifying event, signal count, mapping-confidence label.
- Drill-down to account detail.

### Account detail
- Concise Account Pulse.
- Signal list with external fact, evidence metadata, general Red Hat relevance, validation action, disposition, score, and rationale.
- Clear distinction between prioritized and lower-priority signals.

## Acceptance gates
- All contracts validate against synthetic fixtures.
- UI uses application services rather than fixture files directly.
- Ranking is deterministic, including ties.
- “Mapped accounts only” appears for non-complete mappings.
- Every visible signal preserves all required evidence and guardrail fields.
- No view makes prohibited customer-intent or ownership claims.
- Unit tests cover mapping, ranking, evidence validation, and guardrails.
- One browser test covers portfolio-to-account drill-down.

## Completion record
When complete, add a short `docs/decisions/foundation-v0-completion.md` containing commands run, checks passed, and any known limits. Do not include conversational history.
