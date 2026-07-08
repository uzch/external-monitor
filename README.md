# External Account Signal Monitor

[![CI](https://github.com/uzch/external-monitor/actions/workflows/check.yml/badge.svg)](https://github.com/uzch/external-monitor/actions/workflows/check.yml)
![Status](https://img.shields.io/badge/status-connected%20monitor%20v1-red)
![Data boundary](https://img.shields.io/badge/data-public%20sources%20only-blue)
![Runtime](https://img.shields.io/badge/runtime-local%20first-green)

External Account Signal Monitor is a local-first tool for account teams who need to answer four questions quickly.

1. Where should I look?
2. What changed?
3. Why might it matter through a Red Hat lens?
4. What should I validate next?

It monitors active registered public RSS/Atom sources, stores bounded evidence locally, and keeps retrieved facts separate from Red Hat relevance hypotheses and validation actions.
It does not claim full external-world coverage, customer intent, opportunity, fit, demand, renewal, deployment, ownership, or complete account coverage.

<p align="center">
  <img src="docs/assets/connected-monitor-overview.svg" alt="Connected Monitor v1 overview" width="920">
</p>

## Why It Exists

Account teams do not need another noisy feed.
They need a small number of evidence-backed reasons to inspect an account and a clear next validation step.

This project turns public external signals into a reviewable local workflow.
It is designed so source retrieval, evaluation, ranking, storage, and UI delivery can each be replaced without weakening the evidence boundary.

## What V1 Does

| Capability | Current behavior | Guardrail |
|---|---|---|
| Account setup | Add local monitored accounts and aliases. | Mapping confidence stays explicit. |
| Source setup | Register public RSS/Atom sources per account. | URLs are validated and private network targets are rejected. |
| Retrieval | Run bounded local monitor jobs. | Candidates remain evidence records until evaluated. |
| Evaluation | Optional configured HTTP evaluator can produce semantic records. | No evaluator means no Red Hat relevance or priority claim. |
| Ranking | Account summaries rank only evaluated evidence-backed records. | Unevaluated candidates do not become intent signals. |
| Review | Account detail separates fact, evidence, relevance, uncertainty, and action. | External events are never treated as proof of customer plans. |

## Quick Start

```bash
npm install
npm run build
npm start
```

Open `http://127.0.0.1:8787`.

Local runtime data is stored in `local-data/connected-monitor.sqlite` by default.
`local-data/` is ignored by Git.

## First Walkthrough

1. Add an account.
2. Add one or more aliases that appear in public source text.
3. Register a public RSS/Atom source for that account.
4. Run the monitor.
5. Open the account detail page.
6. Inspect which records are awaiting evaluation, evaluated, abstained, degraded, or failed.

If no evaluator is configured, candidates stay in the awaiting evaluation section.
That is expected and intentional.

## Signal Lifecycle

<p align="center">
  <img src="docs/assets/signal-lifecycle.svg" alt="Signal lifecycle from source to validation action" width="920">
</p>

## Configuration

Copy `.env.example` when you want local overrides.

```text
CM_PORT=8787
CM_DATABASE_PATH=local-data/connected-monitor.sqlite
CM_SEED_CONFIG_PATH=local-data/seed.json
CM_SOURCE_MIN_INTERVAL_MINUTES=30
CM_SOURCE_TIMEOUT_MS=8000
CM_SOURCE_MAX_ENTRIES=25
CM_SOURCE_MAX_RESPONSE_BYTES=1000000
CM_EVALUATOR_BASE_URL=
CM_EVALUATOR_API_KEY=
CM_EVALUATOR_MODEL=
CM_EVALUATOR_TIMEOUT_MS=15000
```

An ignored seed file can create local runtime accounts and source registrations.

```json
{
  "accounts": [
    {
      "name": "Example Corp",
      "aliases": ["Example"],
      "sector": "Financial services",
      "sources": [
        {
          "displayName": "Example public feed",
          "url": "https://example.com/feed.xml"
        }
      ]
    }
  ]
}
```

## Repository Map

| If you want to understand... | Start here |
|---|---|
| Product goal and user value | [`docs/PRODUCT.md`](docs/PRODUCT.md) |
| Architecture and replaceable boundaries | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) |
| Data contracts and validation rules | [`docs/DATA_CONTRACTS.md`](docs/DATA_CONTRACTS.md) |
| Source interpretation limits | [`docs/SOURCE_BOUNDARIES.md`](docs/SOURCE_BOUNDARIES.md) |
| Runtime server and ingestion | [`server/`](server/) |
| Connected UI and API client | [`src/ui/`](src/ui/) and [`src/services/connectedApi.ts`](src/services/connectedApi.ts) |
| E2E behavior | [`tests/e2e/`](tests/e2e/) |
| Synthetic foundation fixtures | [`fixtures/README.md`](fixtures/README.md) |

See [`REPOSITORY_CONTENTS.md`](REPOSITORY_CONTENTS.md) for a fuller tour.

## Checks

```bash
npm run build
npm run test
npm run test:e2e
npm run check
```

The E2E check uses an isolated temporary SQLite database and the local API server.

## Project Direction

Connected Monitor v1 is the ingestion and evidence foundation.
Manual account and source registration is a bootstrap path, not the intended final seller workflow.

The next product direction is intelligent public-source discovery, feedback learning, and agentic prioritization.
Those capabilities should attach through replaceable adapters and review workflows while preserving the separation between external fact, source evidence, Red Hat relevance hypothesis, and validation action.
