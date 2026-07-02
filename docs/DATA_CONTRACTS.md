# Data Contracts

## Principles
- Stable IDs; explicit provenance; ISO-8601 timestamps.
- Variable-depth hierarchy; labels are data, not schema.
- Mapping confidence is explicit.
- Fact, evidence, relevance, and action are separate.

## Core entities

### HierarchyNode
`id`, `parentId?`, `level`, `label`, `path`, `sourceRef`, `effectiveStart?`, `effectiveEnd?`

`level` is configurable (for example, GEO, region, pod, territory); do not hard-code NAPS labels.

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

### RedHatCapability
`id`, `name`, `description`, `themes[]`, `sourceRef`, `active`

## Required validation
- Every visible event has source URL, publication date, retrieval timestamp, external fact, evaluation, and source reference.
- Every assignment references an existing account and hierarchy node.
- Priority is numeric and deterministic in fixture mode.
- No output field may merge fact with relevance or action.
- Dates must be parseable and no source URL may be empty for a visible event.

## Portfolio confidence language
- `illustrative`: display as an example mapping; no ownership or completeness claim.
- `partial_validated`: display “Mapped accounts only.”
- `validated`: may display the loaded scope, but do not claim full coverage unless a separate coverage-completeness field explicitly confirms it.
