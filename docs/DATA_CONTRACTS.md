# Data Contracts

## Principles

- Stable IDs; explicit provenance; ISO-8601 timestamps.
- Variable-depth hierarchy; labels are data, not schema.
- Mapping confidence is explicit.
- Fact, evidence, relevance, and action are separate.

## Core entities

### HierarchyNode

`id`, `parentId?`, `level`, `label`, `path`, `sourceRef`, `effectiveStart?`, `effectiveEnd?`

`level` is configurable, for example GEO, region, pod, or territory.
Do not hard-code NAPS labels.

### Account

`id`, `name`, `aliases[]`, `sector?`, `geography?`, `sourceRef`

### AccountAssignment

`id`, `accountId`, `hierarchyNodeId`, `assignmentType`, `mappingStatus`, `effectiveStart?`, `effectiveEnd?`, `sourceRef`

`mappingStatus`: `illustrative | partial_validated | validated`.

### ExternalEvent

`id`, `accountId`, `title`, `externalFact`, `category`, `sourceName`, `sourceType`, `sourceUrl`, `publicationDate`, `retrievedAt`, `firstSeenAt?`, `excerpt?`, `duplicateGroupId?`, `sourceRef`

### RelevanceEvaluation

`id`, `eventId`, `evaluatorVersion`, `generalRedHatRelevance`, `accountSpecificRelevance?`, `validationAction`, `disposition`, `priorityScore`, `factorScores`, `rationale`, `evaluatedAt`

`disposition`: `prioritized | monitor | context | excluded | duplicate`.

### ResearchRun

`id`, `accountId`, `state`, `importSource`, `executiveSummary`, `sourcePlan`, `sourcesChecked[]`, `sourceGaps[]`, `searchQueriesUsed[]`, `coverageLimitations[]`, `unknownsAndGuardrails[]`, `createdAt`, `updatedAt`, `importedAt`

`state`: `queued | planning | discovering | acquiring | analyzing | synthesizing | completed | partial | abstained | blocked | failed | cancelled`.

`importSource`: `gpt_assisted | manual`.

Research runs are separate from monitor runs.
They describe how research was conducted and what coverage limits apply before the account team reads the brief. Legacy imports remain stored evidence, not the autonomous seller path.

### ResearchSignal

`id`, `researchRunId`, `accountId`, `externalFact`, `sourceUrl`, `publisher`, `publicationDate?`, `retrievedAt`, `excerpt`, `accountMatchBasis`, `sourceCategory`, `disposition`, `dispositionRationale`, `redHatRelevanceHypothesis?`, `validationQuestion?`, `uncertaintyState`, `sortOrder`, `priorityTier`, `createdAt`

`disposition`: `keep | watch | reject | abstain`.

`priorityTier`: `high | medium | low | none`.

Rejected signals require a disposition rationale but do not require a Red Hat relevance hypothesis or validation question.
Rejected signals remain visible as noise and should not be promoted into top validation targets.

### AccountTeamFeedback

`id`, `researchSignalId`, `revision`, `verdict`, `reasons[]`, `explanation?`, `createdAt`, `isCurrent`

`verdict`: `useful | not_useful | unsure`.

`reasons`: `wrong_relevance | incorrect_claim | weak_source | already_known | wrong_entity`.

`not_useful` requires an explanation. Replacements create immutable revisions and only the latest valid revision is current. Feedback is collected for evaluation and does not automatically retrain or modify the system.

### V2 Research Run Views

The FastAPI research runtime persists autonomous runs independently from the v1 monitor.
Run history is ordered newest first and exposes account context, focus, timeframe, state, timestamps, coverage limitations, and counts for `keep`, `watch`, `reject`, and `abstain` signals.

The default seller brief contains only `keep` and `watch` signals.
The evaluated-signal ledger retains all four dispositions in that order and keeps each signal connected to its claim, verification rationale, account-match basis, acquired evidence, canonical URL, dates, and discovery-query provenance.
Discovery results and provider snippets are not evidence and cannot become seller-visible signals until acquisition, extraction, and evaluation complete.

### Versioned Seller Feedback

V2 seller feedback has exactly one current verdict per signal: `useful`, `not_useful`, or `unsure`.
Reasons may include `wrong_relevance`, `incorrect_claim`, `weak_source`, `already_known`, and `wrong_entity`.
`not_useful` requires an explanation.

Replacing feedback creates an immutable timestamped revision and requires the caller's expected revision number. Concurrent or stale replacements fail rather than silently overwriting the current verdict.
Legacy append-only feedback tags remain preserved. They are surfaced as unresolved legacy feedback until reviewed, rather than being silently collapsed into a current verdict.

### RedHatCapability

`id`, `name`, `description`, `themes[]`, `sourceRef`, `active`

## Required validation

- Every visible event has source URL, publication date, retrieval timestamp, external fact, evaluation, and source reference.
- Every assignment references an existing account and hierarchy node.
- Priority is numeric and deterministic in fixture mode.
- No output field may merge fact with relevance or action.
- Dates must be parseable and no source URL may be empty for a visible event.
- Research imports must preserve source plan, checked sources, gaps, coverage limitations, evidence fields, disposition, uncertainty, and guardrails.
- Red Hat relevance must remain a bounded hypothesis, not a claim of customer intent, demand, opportunity, fit, deployment, renewal, ownership, or complete coverage.

## Portfolio confidence language

- `illustrative`: display as an example mapping; no ownership or completeness claim.
- `partial_validated`: display "Mapped accounts only."
- `validated`: may display the loaded scope, but do not claim full coverage unless a separate coverage-completeness field explicitly confirms it.
