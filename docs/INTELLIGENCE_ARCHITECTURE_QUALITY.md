# Intelligence Architecture and Engineering Quality Bar

## Purpose

This document defines the quality bar for architecture, retrieval, autonomous intelligence, learning, and system evolution.

It complements `docs/PRODUCT.md`, `docs/ARCHITECTURE.md`, `docs/DATA_CONTRACTS.md`, `docs/SOURCE_BOUNDARIES.md`, and `docs/MAAS_MODELS.md`. It does not weaken or override their evidence, provenance, uncertainty, privacy, or prohibited-claim boundaries.

Use it when evaluating existing capabilities, designing the next intelligence runtime, choosing technologies, restructuring the backend, or deciding whether an implementation is strong enough to promote.

## Distinguished engineering standard

Operate at the level expected of a Distinguished Chief Architect or Distinguished Engineer in the CTO office of organizations such as Meta, OpenAI, Anthropic, Red Hat, or Google DeepMind.

This means:

- reason from the product objective and system invariants rather than from the current file layout;
- optimize for correctness, intelligence quality, robustness, extensibility, security, observability, evaluation, maintainability, and long-term product value;
- use the smallest high-leverage instruction and context set that produces the strongest verified outcome;
- minimize tokens, repetition, unnecessary artifacts, and low-value process, but never reduce rigor or capability to save context;
- choose the best justified architecture rather than the smallest patch;
- preserve existing code only when it is a sound foundation;
- replace weak abstractions when they would constrain the product or create compounding complexity;
- distinguish a named interface or experimental probe from an integrated, production-quality capability;
- make decisions independently unless a material product, policy, security, or irreversible tradeoff requires user direction.

Codex is not limited to the current implementation language, runtime topology, persistence model, provider boundaries, or orchestration pattern. It may redesign any of them when the redesign materially improves the system and preserves the product boundaries.

## Current repository assessment

This is a point-in-time assessment of the repository represented by the attached `external-monitor-v2-p1` archive. Presence means code or a contract exists. Maturity describes what the repository actually proves.

| Capability | Current location | Proven presence | Quality and maturity finding |
|---|---|---|---|
| Live search | `server/liveSearch.ts`, runtime wiring in `server/httpServer.ts` | A provider interface and an unconfigured implementation expose truthful unavailable state. | Placeholder only. There is no search adapter, query execution, pagination, citation contract, quota handling, retrieval telemetry, search-quality evaluation, or production integration. |
| Public retrieval | `server/publicRetrieval.ts`, `server/probes/retrievalProbe.ts` | Bounded public URL fetching, basic HTML extraction, PDF extraction, excerpts, and fingerprints. | Prototype utility and diagnostic probe. It is not a generalized acquisition and extraction subsystem and is not integrated into account research, evidence persistence, verification, or signal production. |
| RSS and Atom | `server/rssAtomConnector.ts`, `server/monitorRunner.ts` | A working registered-feed path retrieves entries, performs bounded matching and deduplication, optionally evaluates them, persists records, and exposes them through the UI. | Legitimate v1 ingestion substrate, but too rigid to serve as the general retrieval architecture. It must not become the center of a source-type conditional tree. |
| Source safety | `server/sourceSafety.ts` | Public URL validation, DNS and private-address checks, redirect checks, timeout controls, and response limits. | Useful foundation. It remains one layer of a larger fetch-security, content-safety, credentials, policy, isolation, and abuse-resistance architecture. |
| Semantic evaluation | `server/evaluator.ts` | Optional model evaluation for RSS candidates with structured output validation. | Integrated but narrow. It evaluates individual feed candidates and is not a complete research, verification, synthesis, calibration, or learning runtime. |
| MaaS reasoning | `server/maasReasoning.ts`, `server/probes/maasProbe.ts`, `server/probes/maasBenchmark.ts` | Executable planning, extraction, evaluation, and verification probes against configured models. | Model compatibility and qualification experiment. It is not production orchestration and does not discover, retrieve, revise, corroborate, trace, or learn in the account workflow. |
| Capability taxonomy | `server/capabilityTaxonomy.ts` | A small static capability set exists for experimentation. | Temporary hard-coded taxonomy, not an authoritative, extensible knowledge or policy system. |
| Research workflow | `src/domain/researchContracts.ts`, research persistence in `server/sqliteRepositories.ts` | Manual and GPT-assisted research packages can be imported and rendered. | Import workflow only. The system does not autonomously plan, search, acquire, extract, resolve, cluster, verify, rank, synthesize, or revise research. |
| Feedback | `AccountTeamFeedback` contracts and persistence | A small append-only label set and notes can be stored. | Feedback capture only. There is no decision trace, durable training record, replay dataset, offline evaluation, policy comparison, promotion gate, rollback, drift detection, or measurable learning. |

## Material quality findings

### Presence is not capability

Do not describe a capability as implemented merely because the repository contains:

- a file with the capability name;
- an interface;
- an unconfigured provider;
- a probe;
- a benchmark;
- a schema;
- an endpoint returning unavailable state;
- a manually imported result;
- stored feedback.

A capability is implemented only when the end-to-end behavior, integration, evidence, failure handling, observability, security, evaluation, and tests are present at the level required by its intended use.

### `liveSearch.ts` is an extension point, not live search

The current code truthfully reports that search is unavailable. That honesty should be preserved, but the module does not yet provide:

- query planning or execution;
- search-provider adapters;
- result pagination and continuation;
- citation-preserving results;
- provider quotas and retry policy;
- source diversity controls;
- entity-aware query expansion;
- telemetry and cost attribution;
- search recall, precision, or coverage evaluation;
- production orchestration.

### `publicRetrieval.ts` is a bounded experiment, not a retrieval platform

The current utility is useful for proving safe access to public HTML and PDF resources. It does not yet provide the broader system required for heterogeneous acquisition and evidence extraction, including:

- browser-rendered pages;
- content-handler and extractor registries;
- document-layout preservation;
- page, section, paragraph, table, or coordinate citations;
- structured-data extraction;
- charset and language handling;
- conditional fetch, caching, and revisit policy;
- authentication and source-specific access policy;
- extraction-quality scoring;
- durable raw-artifact storage;
- integration with claims, provenance, verification, and decision traces.

### RSS and Atom are one retrieval family

RSS and Atom should remain supported because they provide efficient incremental acquisition for some official sources. They are not the universal model for public research.

Do not scale the system by:

- widening one `sourceType` union repeatedly;
- adding source-specific branches to `MonitorRunner`;
- forcing search, crawling, APIs, feeds, documents, and rendered pages through one identical connector method;
- representing every acquired item as a feed entry;
- treating source registration as the final seller workflow.

### MaaS probes are qualification infrastructure

The current probes are useful for measuring provider compatibility, structured-output reliability, latency, token use, and model failure modes. They do not prove an autonomous account-intelligence system.

The production runtime still requires:

- a research state machine;
- policy-aware planning;
- tool and connector selection;
- iterative query revision;
- acquisition and extraction;
- entity resolution;
- event and claim clustering;
- source corroboration;
- claim verification;
- relevance evaluation;
- ranking and calibration;
- abstention;
- brief synthesis;
- complete decision tracing;
- replay and evaluation.

### Feedback storage is not learning

A genuine learning system must create measurable behavior improvement. It must instrument decisions and outcomes, create durable replayable records, compare candidate policies or learned components offline, gate promotion, deploy versioned changes, monitor drift, and support rollback.

The required learning architecture is described later in this document.

## Required system shape

The target is a heterogeneous, capability-oriented external intelligence platform, not a feed reader with more connectors.

### Separate the research stages

The architecture must keep these responsibilities distinct:

```text
research objective
  -> context and policy resolution
  -> research planning
  -> discovery
  -> resource enumeration
  -> acquisition
  -> extraction
  -> evidence normalization
  -> entity resolution
  -> event and claim clustering
  -> corroboration and verification
  -> relevance evaluation
  -> ranking, calibration, and abstention
  -> brief generation
  -> seller interaction and outcome capture
  -> offline learning and controlled promotion
```

These stages may be implemented in one deployable runtime initially, but their contracts, state transitions, provenance, and failure semantics must remain explicit.

### Support heterogeneous retrieval families

The platform must be capable of supporting approved sources such as:

- general web search;
- news and media search;
- official organization websites and newsrooms;
- RSS and Atom feeds;
- sitemaps and change indexes;
- public structured APIs;
- regulatory databases;
- government portals;
- procurement and tender systems;
- corporate filings;
- investor-relations materials;
- earnings releases and transcripts;
- HTML pages;
- browser-rendered applications;
- PDFs and office documents;
- public datasets and data files;
- source-code repositories and release logs;
- approved public community or social sources;
- future MCP, tool-gateway, partner, or approved internal adapters.

Do not assume that all of these support the same operations.

### Use capability-oriented connectors

Connectors should declare what they can do rather than inherit one universal behavior.

Representative capabilities include:

```text
discover
search
enumerate
poll
fetch
render
query_structured
retrieve_binary
stream_changes
supports_since_cursor
supports_pagination
supports_conditional_fetch
requires_authentication
provides_publication_metadata
provides_stable_identifiers
provides_native_citations
```

A connector may implement one or several capabilities. The planner and orchestration runtime should select operations based on the research objective, source policy, account context, connector health, expected information gain, cost, and prior measured performance.

### Normalize after acquisition, not before it

Search, feeds, APIs, pages, filings, and documents should not be forced into an identical acquisition interface.

They should converge into a durable evidence model after source-specific acquisition and extraction.

A normalized evidence envelope should preserve:

- immutable raw-artifact or response reference;
- source, connector, operation, and request identity;
- canonical resource identity;
- account and entity candidates;
- publication, modification, first-seen, and retrieval timestamps with provenance;
- extracted document structure;
- passage, page, section, table, or coordinate locations;
- normalized evidence segments;
- source-native identifiers and citations;
- content and artifact fingerprints;
- access and coverage limitations;
- extraction and source-quality signals;
- policy state;
- complete lineage to claims and model decisions.

Unknown source dates must remain unknown. Retrieval time must not be substituted for publication time.

## Autonomous intelligence runtime

The intelligence system must be able to execute a bounded research objective from account context to a seller-useful, evidence-backed brief.

It should support:

- plan generation and plan revision;
- source and connector selection;
- query generation, expansion, and reformulation;
- parallel and sequential research where justified;
- budget, latency, and stopping policies;
- entity and alias resolution;
- duplicate and evolving-event clustering;
- claim extraction with evidence spans;
- cross-source corroboration and conflict handling;
- source reputation by task and claim type;
- relevance reasoning bounded by available context;
- uncertainty decomposition;
- confidence calibration;
- abstention when evidence is insufficient;
- transparent coverage limitations;
- account and portfolio prioritization;
- full traceability of intermediate decisions.

No model should be allowed to transform unsupported interpretation into fact. External fact, evidence, account-match basis, Red Hat relevance hypothesis, validation action, uncertainty, and disposition remain separate records.

## Real learning and feedback architecture

The intelligence system must include a genuine ML-grade learning loop, not merely a feedback form or stored comments.

### Instrument decisions and outcomes

Instrument at minimum:

- research plans and revisions;
- generated and executed queries;
- connector and source choices;
- retrieval successes and failures;
- extracted evidence;
- entity-match candidates and decisions;
- clustering and duplicate decisions;
- rejection and promotion decisions;
- verification outcomes;
- model, prompt, tool, policy, and ranking versions;
- confidence and abstention decisions;
- seller-visible outputs;
- seller interactions;
- downstream validation and action outcomes.

### Capture explicit feedback

Support at minimum:

- `useful`;
- `not_useful`;
- `already_known`;
- `wrong_entity`;
- `weak_source`;
- `wrong_relevance`;
- `missing_event`;
- `incorrect_claim`;
- `follow_up_requested`.

### Capture implicit feedback carefully

Potential implicit observations include:

- evidence opened;
- signal expanded;
- copied or shared;
- saved;
- dismissed;
- time spent;
- repeated use;
- follow-up initiated;
- downstream validation;
- downstream action.

Implicit events are observations, not ground-truth labels. Their semantics and confidence must be explicit.

### Create durable learning records

A replayable learning record must preserve or reference:

- input context;
- research plan;
- queries;
- retrieved evidence;
- source metadata;
- intermediate decisions;
- model and prompt versions;
- tools and policy versions;
- output;
- feedback labels;
- provenance;
- timestamps;
- confidence;
- validation outcome;
- downstream outcome;
- training eligibility and retention class.

Records should be append-only. Corrections should supersede rather than erase prior records.

### Separate memory and policy scopes

Keep these logically and operationally separate:

- per-user preferences;
- account-specific memory;
- organization-level policy;
- globally learned behavior.

Organization policy overrides user, account, or learned preferences. Account-specific information must not leak into unrelated accounts or global memory.

### Use controlled learning progression

Do not allow uncontrolled online self-modification.

Use this progression:

1. collect high-quality feedback and decision traces;
2. build immutable replayable datasets;
3. run offline evaluation;
4. compare candidate policies, prompts, models, ranking functions, retrieval strategies, or learned components;
5. gate promotion through measurable improvement and safety checks;
6. deploy with versioning, bounded rollout, monitoring, rollback, and drift detection.

### Support advanced methods only when justified

The architecture should permit:

- supervised ranking;
- learning-to-rank;
- contextual bandits with conservative exploration;
- active learning;
- weak supervision;
- preference learning;
- source-reputation models;
- retrieval-policy optimization;
- calibration models;
- human-in-the-loop review;
- embedding and graph-based memory.

The method must fit the data quality, risk, and measurable objective. Do not add ML techniques for appearance or architectural prestige.

### Measure whether learning works

Measure at minimum:

- precision of promoted signals;
- recall of material events;
- unsupported-claim rate;
- entity-match accuracy;
- duplicate-clustering quality;
- ranking quality;
- citation accuracy;
- verification accuracy;
- abstention quality;
- calibration;
- seller usefulness;
- repeat usage;
- downstream validation success;
- latency and cost;
- trace and replay completeness.

Feedback storage without measurable behavior improvement is not a learning system.

## Architecture freedoms and obligations

Codex has authority to:

- replace Node-only backend assumptions;
- introduce Python, FastAPI, workflow engines, queues, event logs, vector or graph stores, search indexes, object storage, or other technologies when justified;
- split or combine services based on clear operational reasoning;
- redesign persistence and data contracts with migration paths;
- introduce asynchronous orchestration, parallelism, caching, scheduling, and continuation semantics;
- replace provider interfaces that are too weak;
- create new evaluation and observability infrastructure;
- remove obsolete experimental code after its value is preserved through tests, migration, or documentation.

That freedom carries obligations:

- preserve truthful product states and evidence boundaries;
- keep secrets and privileged data server-side;
- protect against unsafe retrieval and source abuse;
- preserve reproducibility, provenance, and auditability;
- provide migrations and rollback for durable state;
- test critical behavior at unit, integration, contract, replay, and end-user levels;
- measure improvements rather than asserting them;
- document material architectural decisions and rejected alternatives;
- avoid speculative infrastructure without a concrete role in the target system.

## Anti-patterns

Reject designs that:

- optimize for minimal diff instead of system quality;
- preserve weak abstractions solely because they already exist;
- place all research logic in one `MonitorRunner` or controller;
- add repeated `sourceType` conditionals;
- use one connector method for fundamentally different source behaviors;
- let the UI call connectors, databases, model providers, or secrets directly;
- treat model output as evidence;
- lose raw source provenance during normalization;
- fabricate missing publication dates or account mappings;
- describe unavailable or probe-only capabilities as implemented;
- store feedback without a path to replay, evaluation, and gated behavior improvement;
- perform online self-modification without evaluation and rollback;
- build a graph, embedding store, agent framework, or distributed system without a measured product need;
- create extensive documentation or abstractions that add context cost without improving decisions or outcomes.

## Decision test

For every material architecture or implementation decision, be able to answer:

1. What product outcome or invariant does this decision serve?
2. What evidence shows the current approach is insufficient or the proposed approach is stronger?
3. Does it support heterogeneous retrieval and future unknown source classes?
4. Are evidence, claims, provenance, policy, and model conclusions still separate?
5. Can the behavior be observed, evaluated, replayed, and rolled back?
6. Does it improve signal quality or reduce noise, risk, latency, cost, or complexity?
7. Is the added abstraction or infrastructure justified now?
8. What failure modes remain, and how are they surfaced truthfully?

## Promotion standard

Do not promote a subsystem as production-quality until its required end-to-end path has:

- real integration rather than a probe-only path;
- explicit contracts and state transitions;
- bounded failure and retry behavior;
- provenance and evidence preservation;
- security and policy enforcement;
- observability, cost, and latency attribution;
- representative tests;
- offline or replay evaluation where intelligence is involved;
- measurable acceptance criteria;
- versioning and rollback for material behavior changes;
- documentation that matches the implementation.

The final standard is not whether the code runs. It is whether the system produces stronger, safer, measurable intelligence outcomes in practice without becoming rigid, opaque, or unmaintainable.
