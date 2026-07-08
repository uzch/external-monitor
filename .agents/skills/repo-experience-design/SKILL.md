---
name: repo-experience-design
description: Improve a repository landing experience, first-time comprehension, navigability, GitHub presentation, README quality, contributor orientation, and documentation truthfulness. Use when asked to make a repo easier to understand, polish project framing, clarify current state versus future vision, improve AGENTS routing, add GitHub-native UX, or audit docs as a first-time reviewer. Protect controlled hero assets unless separately authorized.
---

# Repo Experience Design

Use this Skill to improve how a repository explains itself to first-time human reviewers and technical contributors.

## Core Loop

Repeat until the repo is clean, digestible, navigable, and truthful:

1. Assess the repo as a first-time human reviewer and as a technical contributor.
2. Identify gaps in clarity, navigation, project framing, current-state understanding, and repo flow.
3. Score the quality gates in a pass/fail table.
4. Fix the narrowest appropriate artifacts for failed gates.
5. Reassess with another quality-gate table.
6. Record iteration count and final pass/fail.
7. Report what changed and what still needs authorization.

## Quality-Gate Table

Use this table in every iteration:

| Gate | Pass/Fail | Evidence | Narrow fix if failed |
|---|---|---|---|
| First-time reviewer comprehension |  |  |  |
| Technical contributor navigation |  |  |  |
| v1 current-state clarity |  |  |  |
| Future-vision distinction |  |  |  |
| Known-limitations visibility |  |  |  |
| README landing quality |  |  |  |
| AGENTS routing quality |  |  |  |
| Hero asset controlled-status handling |  |  |  |

If any gate fails, make the narrowest fix and reassess.
Do not claim completion until the final table passes or the remaining failure needs explicit authorization.

## Controlled Hero Asset Rule

Treat the README hero asset at the top as protected.

You may evaluate it, critique it, recommend improvements, or write an asset brief.
You must not edit, replace, regenerate, move, rename, compress, optimize, or otherwise modify the actual hero image, GIF, or SVG unless the user explicitly authorizes that in a separate task.

If no approved hero asset exists, create a clearly marked TODO or asset brief instead of inserting a low-quality generated visual.
Do not add a visual merely to satisfy a hero requirement.

## Preferred Artifacts

Prefer the smallest set of artifacts that materially improves repo comprehension:

- `README.md` for the first-time human landing page.
- `REPOSITORY_CONTENTS.md` or other index docs for contributor navigation.
- `AGENTS.md` for concise durable rules and routing to docs or Skills.
- `.github/PULL_REQUEST_TEMPLATE.md` for review guardrails.
- `.github/ISSUE_TEMPLATE/` for repeatable intake.
- Mermaid only when it improves understanding and will render cleanly on GitHub.
- Existing controlled hero assets by reference only.

## Do Not Do

- Do not add runtime product architecture during repo-experience work.
- Do not implement FastAPI, MCP, discovery, feedback learning, or agentic prioritization unless separately requested.
- Do not touch `local-data/` or `manual-test-evidence/`.
- Do not use manual-test artifacts as fixtures.
- Do not hide known limitations.
- Do not overstate external events as proof of customer intent, fit, demand, renewal, deployment, ownership, or complete coverage.
- Do not modify the controlled README hero asset without separate authorization.

## Assessment Checklist

Read only what the task needs.
For Connected Monitor v1 repo experience, usually inspect:

- `README.md`
- `AGENTS.md`
- `REPOSITORY_CONTENTS.md`
- `docs/PRODUCT.md`
- `docs/ARCHITECTURE.md`
- `docs/DATA_CONTRACTS.md`
- `docs/SOURCE_BOUNDARIES.md`
- `.github/`
- `.gitignore`

Check whether a visitor can answer:

- What is this project?
- What does v1 do today?
- Why is v1 valuable?
- What is intentionally out of scope?
- How do I run it?
- How do I validate it?
- Where do I change UI, server, contracts, tests, and docs?
- What artifacts are generated or user-owned and should not be committed?

## Edit Guidance

Use short, clear sections.
Prefer tables for navigation.
Keep README polished but not bloated.
Keep AGENTS concise and route detailed repeatable procedures to Skills.
Keep current state separate from future vision.
Keep limitations visible.
Use readable concise Markdown with plain hyphens and no em dash punctuation.
Follow existing file style unless the task explicitly asks for restructuring.

## Validation

Before claiming completion:

1. Scan changed docs for prohibited punctuation or obvious encoding defects when the repo requires ASCII.
2. Confirm `.gitignore` covers runtime, generated, and user-owned artifacts, or report any gap that needs authorization.
3. Run the canonical validation command if available.
4. Report changed files, validation result, final git status, proposed commit message, iteration count, and final gate results.
