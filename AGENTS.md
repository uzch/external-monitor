# External Account Signal Monitor

Build a local tool that helps users answer: where to look, what changed, why it may matter through a Red Hat lens, and what to validate next.

## Rules

- Never use em dash punctuation. Use plain hyphen instead.
- When writing commit messages, NEVER auto-add your agent name as co-author.
- Never manually modify CHANGELOG.md files or any files that are marked as auto-generated.
- Use readable concise Markdown with plain hyphens and no em dash punctuation. Follow existing file style unless the task explicitly asks for restructuring.
- When making technical decisions, do not give much weight to development cost. Instead, prefer quality, simplicity, robustness, scalability, and long term maintainability.
- When doing bug fixes, always start with reproducing the bug in an E2E setting as closely aligned with how an end user would experience it. This makes sure you find the real problem so your fix will actually solve it.
- When end-to-end testing a product, be picky about the UI you see and be obsessed with pixel perfection. If something clearly looks off, even if it is not directly related to what you are doing, try to get it fixed along the way.
- Apply that same high standard to engineering excellence: lint, test failures, and test flakiness. If you see one, even if it is not caused by what you are working on right now, still get it fixed.
- Keep external fact, source evidence, Red Hat relevance hypothesis, and validation action separate.
- Never present an external event as proof of customer intent, opportunity, fit, demand, renewal, deployment, ownership, or complete coverage.
- Treat NAPS as configuration, not a hard-coded universal hierarchy.
- Validate inputs at boundaries. Keep providers replaceable. Do not couple UI directly to fixture files.
- Surface unrelated scope changes if they cannot be safely, testably, and easily fixed within the active subsystem.
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
- Repo landing, navigation, GitHub UX, and first-time comprehension: `.agents/skills/repo-experience-design/SKILL.md`

## Working style

- Be concise by default.
- Do not restate settled requirements or routine work.
- Surface material risks, contradictions, better approaches, unexpected findings, and improvement opportunities when they could meaningfully affect the outcome.
- Do not omit useful information solely to minimize output.
- Ask only about material blockers. Otherwise make the best justified decision and proceed.
