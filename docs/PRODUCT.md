# Product

## Objective
Help account teams and sales leaders identify **where to look**, understand **what changed**, assess **why it may matter through a Red Hat lens**, and decide **what to validate next**.

## Users and workflow

| User | Primary question |
|---|---|
| Account executive / account team | What changed in this account and what should we validate? |
| Pod leader | Which accounts in my mapped portfolio deserve attention? |
| Region leader | Where are meaningful changes concentrated across mapped accounts? |

Workflow: `hierarchy scope -> ranked accounts -> account detail -> evidence -> relevance -> action`.

## Required output per visible signal
1. External fact: a bounded factual statement.
2. Evidence: publisher, URL, publication date, retrieval time, source type.
3. General Red Hat relevance hypothesis: why it may be worth investigating.
4. Optional account-specific relevance: only when approved account context exists.
5. Validation action: a question or research/action step.

## Product principles
- Broad candidate capture; narrow seller prioritization.
- Evidence before interpretation.
- Relevance is not proof of customer intent or fit.
- Portfolio claims cannot exceed loaded mapping confidence.
- NAPS is the first configuration, not a global schema.
- Future integrations must attach through adapters.

## Connected Monitor v1 scope
- Current v1 is a connected ingestion and evidence foundation for locally registered public RSS/Atom sources.
- Manual account and source registration is a bootstrap/admin path, not the final seller workflow.
- Retrieved candidates remain evidence records until an approved evaluator produces bounded relevance, uncertainty, and validation action fields.
- When no evaluator is configured, candidates are stored as awaiting evaluation and no semantic priority or Red Hat relevance claim is produced.

## Future product direction
- Intelligent public-source discovery to reduce manual registration.
- Feedback learning from review and validation outcomes.
- Agentic prioritization that recommends where to look next while preserving evidence, uncertainty, and prohibited-claim boundaries.

## Foundation v0 scope
- Local hierarchy, account, assignment, event, evaluation, and capability fixtures.
- Portfolio filtering and deterministic ranking.
- Account drill-down with an Account Pulse and full signal metadata.
- Explicit incomplete-mapping, empty, and invalid-data states.

## Not in Foundation v0
- Live retrieval or web search.
- RAG, MCP, APIs, Salesforce, Slack, email, or internal Red Hat data.
- Automatic outreach, opportunity creation, forecasting, or intent claims.
- Claims of complete territory coverage or current ownership.
