---
name: git-pr-lifecycle
description: Use when local changes are ready to move through commit, push, draft pull request creation, PR self-review, and merge-readiness evaluation. Applies to workflows that need gated git status inspection, scoped staging, validation confirmation, commit creation, branch push, draft PR opening, PR diff review, CI/check review, merge conflict assessment, and explicit authorization before marking ready or merging.
---

# Git PR Lifecycle

Use this Skill when changes are ready to move from local edits to commit, push, draft PR, PR self-review, and merge-readiness evaluation.

Report every gate as `Pass` or `Fail` with evidence.
Stop at the first failed gate unless the failure can be narrowly fixed within the approved task scope.

## Hard Rules

- Never commit `local-data/`, `manual-test-evidence/`, `.codex/`, `node_modules/`, `dist/`, `dist-server/`, `.env`, SQLite files, logs, screenshots, or generated artifacts.
- Never stage user-owned, runtime, generated, secret, or unrelated files.
- Never hide known limitations.
- Never add co-author, agent attribution, tags, or similar metadata to commits.
- Never mark a draft PR ready for review unless explicitly authorized.
- Never merge unless explicitly authorized.
- Preserve unrelated working tree changes.

## Lifecycle

### 1. Pre-Commit Gate

Inspect and report:

- `git status --short --branch`
- changed files and whether each belongs to the task scope
- staged files, if any
- ignored or untracked runtime/user-owned/generated artifacts
- validation command and result
- proposed commit message

Confirm:

- runtime/user-owned/generated artifacts are not staged
- validation passed
- changed files match the task scope
- commit message is approved or clearly proposed for approval

Gate output:

| Check | Pass/Fail | Evidence |
|---|---|---|
| Status inspected |  |  |
| Staged scope clean |  |  |
| Runtime/user/generated artifacts excluded |  |  |
| Validation passed |  |  |
| Changed files match task scope |  |  |
| Commit message confirmed |  |  |

### 2. Commit Gate

Stage only approved files.
Prefer explicit path staging when the worktree contains unrelated changes.

Commit with the approved message.
Do not add co-author or agent attribution metadata.

Gate output:

| Check | Pass/Fail | Evidence |
|---|---|---|
| Only approved files staged |  |  |
| Commit created |  |  |
| Commit message matches approval |  |  |
| No attribution metadata added |  |  |

### 3. Push Gate

Push the current feature branch.
Verify the upstream branch exists.

Use the current branch unless the user explicitly asks to rename or create a different branch.
Do not push directly to `master` unless explicitly authorized.

Gate output:

| Check | Pass/Fail | Evidence |
|---|---|---|
| Current branch confirmed |  |  |
| Branch pushed |  |  |
| Upstream branch exists |  |  |

### 4. Draft PR Gate

Open a draft PR targeting `master` unless told otherwise.
Use a concise PR title and body.

The PR body must include:

- summary
- validation
- known limitations
- follow-ups

Do not mark the PR ready for review unless explicitly authorized.

Gate output:

| Check | Pass/Fail | Evidence |
|---|---|---|
| Base branch confirmed |  |  |
| Draft PR opened |  |  |
| Title concise |  |  |
| Body includes summary |  |  |
| Body includes validation |  |  |
| Body includes known limitations |  |  |
| Body includes follow-ups |  |  |

### 5. PR Self-Review Gate

Inspect the PR diff after creation.

Confirm:

- no accidental files
- docs and code match actual implementation
- no overstated claims
- known limitations remain visible
- CI/check status is inspected when available

If CI/check status is unavailable or pending, report it as a merge-readiness blocker or residual risk.

Gate output:

| Check | Pass/Fail | Evidence |
|---|---|---|
| PR diff inspected |  |  |
| No accidental files |  |  |
| Docs match implementation |  |  |
| No overstated claims |  |  |
| Known limitations visible |  |  |
| CI/check status inspected |  |  |

### 6. Merge-Readiness Gate

Evaluate whether the PR is mergeable.

Check for:

- merge conflicts
- failing checks
- pending checks that should finish first
- missing review items
- risky diffs
- scope drift
- unresolved known limitations that should block merge

Do not merge unless explicitly authorized.
If authorized, merge only after this gate passes or after the user explicitly accepts the listed risks.

Gate output:

| Check | Pass/Fail | Evidence |
|---|---|---|
| Mergeability inspected |  |  |
| No merge conflicts |  |  |
| Checks passing or accepted |  |  |
| No missing review items |  |  |
| No risky unaccepted diffs |  |  |
| No scope drift |  |  |
| Merge authorization present |  |  |

## Final Output

Report:

- commit hash
- branch pushed
- PR URL
- PR status
- validation result
- self-review result
- merge-readiness result
- remaining blockers

If a lifecycle step was not performed, say `Not performed` and explain why.
