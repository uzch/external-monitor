# External Account Signal Monitor

Build a local tool that helps users answer: where to look, what changed, why it may matter through a Red Hat lens, and what to validate next.

## Rules

- Keep external fact, source evidence, Red Hat relevance hypothesis, and validation action separate.
- Never present an external event as proof of customer intent, opportunity, fit, demand, renewal, deployment, ownership, or complete coverage.
- Treat NAPS as configuration, not a hard-coded universal hierarchy.
- Use local synthetic fixtures only unless an approved plan explicitly adds an integration.
- Do not add private source material, credentials, customer data, live retrieval, APIs, RAG, MCP, Salesforce, Slack, email, or network calls without approval.
- Keep milestones bounded, but do not choose an inferior solution solely to reduce implementation time.
- Within scope, favor correctness, maintainability, extensibility, reliability, and polished UX.
- Validate inputs at boundaries. Keep providers replaceable. Do not couple UI directly to fixture files.
- Treat visible UI defects and broken end-to-end flows as product defects. Inspect rendered output and fix them before completion.
- Fix clearly related defects encountered during work when they are safe, testable, and within the active subsystem. Surface unrelated scope changes.
- Do not manually edit generated files or files marked auto-generated.
- Use plain hyphens, never em dashes.
- Keep prose paragraphs on one physical line. Do not reflow existing prose unless necessary.
- Never add agent attribution, co-author lines, tags, or similar metadata to commits.
- Do not restate settled requirements, list routine work, or provide speculative alternatives unless asked.
- Ask only about material blockers. Otherwise make the best justified decision and proceed.
- Before claiming completion, run the checks required by the active plan.

## Read only what the task needs

- Product or UX: `docs/PRODUCT.md`
- Data, schemas, fixtures: `docs/DATA_CONTRACTS.md`
- Architecture, integrations, refactors: `docs/ARCHITECTURE.md`
- Foundation v0: `docs/plans/FOUNDATION_V0.md`
- Fixture edits: `fixtures/README.md`
- Source interpretation: `docs/SOURCE_BOUNDARIES.md`

## Working style

- Be concise by default.
- Do not restate settled requirements or routine work.
- Surface material risks, contradictions, better approaches, unexpected findings, and improvement opportunities when they could meaningfully affect the outcome.
- Do not omit useful information solely to minimize output.
- Ask only about material blockers. Otherwise make the best justified decision and proceed.