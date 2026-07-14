# Repository Contents

This repository contains a local-first connected monitor for public account signals.
It includes the React UI, local Node HTTP server, SQLite persistence, RSS/Atom retrieval, source-safety checks, evaluator boundaries, tests, and durable product documentation.

It intentionally does not contain raw source workbooks, customer data, credentials, private account material, or internal Red Hat data.

## Start Here

| Need | File or folder |
|---|---|
| Understand the product promise | `README.md` |
| Understand users, value, and workflow | `docs/PRODUCT.md` |
| Understand system boundaries | `docs/ARCHITECTURE.md` |
| Understand the intelligence architecture quality bar and current capability assessment | `docs/INTELLIGENCE_ARCHITECTURE_QUALITY.md` |
| Understand data contracts | `docs/DATA_CONTRACTS.md` |
| Understand source interpretation limits | `docs/SOURCE_BOUNDARIES.md` |
| Understand synthetic fixture rules | `fixtures/README.md` |
| Improve repo landing and navigation | `.agents/skills/repo-experience-design/SKILL.md` |

## Product Surface

| Area | Purpose |
|---|---|
| `src/App.tsx` | Application shell and page outlet. |
| `src/ui/PortfolioPage.tsx` | Runtime setup, account ranking table, monitor run history. |
| `src/ui/AccountDetailPage.tsx` | Account detail, source controls, evidence and evaluation sections. |
| `src/services/connectedApi.ts` | Browser client for the local connected API. |
| `src/styles.css` | Shared visual system and responsive layout rules. |

## Runtime Surface

| Area | Purpose |
|---|---|
| `server/index.ts` | Runtime entry point. |
| `server/httpServer.ts` | Static app serving and API routes. |
| `server/config.ts` | Environment configuration and optional local seed loading. |
| `server/monitorRunner.ts` | Monitor job orchestration. |
| `server/rssAtomConnector.ts` | RSS/Atom retrieval and parsing. |
| `server/sourceSafety.ts` | Public-source URL and response safety checks. |
| `server/evaluator.ts` | Optional semantic evaluator adapter and output validation. |
| `server/sqliteRepositories.ts` | Local SQLite persistence. |

## Tests

| Area | Purpose |
|---|---|
| `tests/unit/` | Domain, ranking, source-safety, parsing, runner, and UI unit coverage. |
| `tests/e2e/portfolio-drilldown.spec.ts` | End-user runtime setup, drilldown, and mobile usability coverage. |
| `tests/e2e/staticServer.ts` | Test-only local server harness with isolated SQLite data. |

## GitHub Experience

| Area | Purpose |
|---|---|
| `.github/workflows/check.yml` | CI for build, unit tests, and E2E tests. |
| `.github/PULL_REQUEST_TEMPLATE.md` | Review checklist for evidence-bound changes. |
| `.github/ISSUE_TEMPLATE/ux-gap.yml` | Report confusing app, repo, or docs navigation. |
| `.github/ISSUE_TEMPLATE/source-boundary.yml` | Report overclaim or source-boundary concerns. |
| `docs/assets/` | GitHub-rendered SVG diagrams used by the README. |
| `.agents/skills/repo-experience-design/SKILL.md` | Repeatable repo-experience review loop. |

## Local Artifacts

Generated build output, Playwright evidence, SQLite runtime data, dependency folders, environment files, and private input files are ignored by Git.
Local runtime data defaults to `local-data/connected-monitor.sqlite`.
