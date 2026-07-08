# External Account Signal Monitor

A local-first monitoring application for registered public account sources. It helps users inspect where to look, what changed, why it may matter through a Red Hat lens, and what to validate next.

Connected Monitor v1 monitors active registered RSS/Atom sources only. It does not claim full external-world coverage, customer intent, opportunity, fit, demand, renewal, deployment, ownership, or complete account coverage.

Connected Monitor v1 is the current connected ingestion and evidence foundation. Manual account and source registration is a bootstrap/admin path so users can create local monitored accounts, register approved public RSS/Atom sources, retrieve bounded candidates, preserve evidence metadata, and keep unevaluated records separate from Red Hat relevance hypotheses or validation actions.

The product vision extends beyond this bootstrap path toward intelligent source discovery, feedback learning, and agentic prioritization. Those capabilities are not implemented in v1 and should attach through approved, replaceable adapters without weakening the evidence and overclaim boundaries.

## Run Locally

```bash
npm install
npm run build
npm start
```

Open `http://127.0.0.1:8787`.

Local runtime data is stored in `local-data/connected-monitor.sqlite` by default. `local-data/` is ignored by Git.
Manual test evidence captures, generated build output, dependency folders, environment files, and SQLite runtime databases are user/runtime artifacts and are ignored by Git.

## Configuration

Optional environment variables:

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

When evaluator endpoint, API key, and model are not configured, retrieved candidates are stored as awaiting evaluation. The app does not generate Red Hat relevance hypotheses, validation actions, or semantic priority claims without an evaluated evidence-backed record.

An ignored seed file may create local runtime accounts and source registrations:

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

## Checks

```bash
npm run build
npm run test
npm run test:e2e
```

The e2e check uses an isolated temporary SQLite database and the local API server.
