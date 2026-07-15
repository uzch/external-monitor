# Product

## Objective

Help account teams identify where to look, understand what changed externally, assess why it may matter through a bounded Red Hat lens, and decide what to validate next.

## Current workflow

```text
account and optional focus -> research run -> evidence-backed brief -> validation questions -> feedback
```

The seller supplies account context, not source URLs, search queries, JSON, conclusions, or relevance hypotheses.

## Current product surfaces

### Connected Monitor v1

V1 is the local evidence and ingestion foundation:

- register public RSS/Atom sources and account aliases;
- retrieve bounded public-source candidates with source-safety checks;
- persist evidence locally in SQLite;
- optionally evaluate and rank evidence-backed records;
- inspect account details and monitor history.

V1 remains useful compatibility infrastructure. RSS/Atom is an ingestion substrate, not the primary account-team workflow.

### V2 research workspace

V2 is the current account-agnostic research surface:

- start or reopen a persisted research run;
- use FastAPI orchestration with configured MaaS reasoning;
- select among Tavily direct API, Tavily MCP, and Brave discovery paths when available;
- acquire HTML, PDF, and browser content through system-owned retrieval;
- preserve evidence, citations, provenance, uncertainty, and decision traces;
- show a concise Account Signal Brief followed by the complete evaluated-signal ledger;
- retain keep, watch, reject, and abstain candidates;
- capture one current account-team feedback verdict with immutable revisions.

## Required output per visible signal

1. External fact: a bounded factual statement.
2. Evidence: publisher, URL, publication date, retrieval time, source type, and excerpt.
3. Account match basis: why the evidence refers to the requested account or entity.
4. Verification: support, contradiction, or insufficiency with rationale.
5. Red Hat relevance hypothesis: why it may be worth investigating, never proof of intent or fit.
6. Validation action: a question or next research step.
7. Disposition: keep, watch, reject, or abstain.
8. Uncertainty and disposition rationale.

## Product principles

- Evidence before interpretation.
- Broad candidate capture, narrow seller prioritization.
- Discovery metadata and source evidence remain separate.
- Relevance is not proof of customer intent, demand, opportunity, fit, renewal, deployment, or ownership.
- Unknown data remains unknown.
- Providers, models, retrieval paths, storage, and delivery surfaces remain replaceable.
- Feedback is collected for evaluation and does not automatically retrain or modify the system.

## Current capability state

- MaaS reasoning is available through the configured Red Hat Demo Platform endpoint.
- Tavily direct API and MCP paths are implemented with separate readiness and provenance.
- Brave Web and News Search are implemented but unavailable in the current local capability report.
- FastAPI, PostgreSQL, Temporal, MinIO, and the intelligence worker provide the current V2 runtime path.
- The current implementation is local and single-user. It is not a deployed enterprise platform or a claim of complete public-web coverage.
- Advanced policy learning, Salesforce, Slack, email, scheduling, and portfolio-wide prioritization remain future work.

## Future direction

The long-term product should independently discover where to look, retrieve heterogeneous public sources, verify claims, revise research when evidence is weak, synthesize concise briefs, and improve through measured replay and evaluation. Those capabilities must preserve the separation between external fact, evidence, bounded hypothesis, validation action, and uncertainty.
