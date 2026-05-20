---
name: parallel-review
description: Use when a task passes verification and needs multi-dimensional review before completion
---

# Parallel Review

## Overview

Orchestrates parallel review dispatches: two for per-task (spec compliance, code quality)
with spec-first precedence, and a third (guardian) at the final whole-implementation
review. Composes `requesting-code-review` as the
underlying dispatch primitive. Used by SDD after every task implementation
and at final review.

## When to Use

- After a worker reports DONE and task verification passes
- As part of SDD's per-task flow
- When a single code state needs independent verification from spec and quality
  perspectives simultaneously

Not for ad-hoc single-dimension reviews — use requesting-code-review directly for those.

## The Pattern

After a task passes verification, dispatch two subagents in parallel
(all with `context: "fresh"`):

1. `reviewer` for spec compliance (use `spec-reviewer-prompt.md`)
2. `reviewer` for code quality (use `code-quality-reviewer-prompt.md`)

**If a worktree is being used**, set `cwd: /path/to/worktree` on every
subagent dispatch so reviewers resolve paths and git root
correctly.

## Spec Precedence

Watch the spec reviewer first:

**If the spec reviewer reports any issue:**
- Stop waiting for code-quality feedback
- Cancel the code-quality review if it is still running
- Discard its results if already returned
- Send the spec issues to the worker
- Re-run verification after the fix
- Dispatch both reviewers again on the new code state

**If the spec reviewer approves:**
- Use code-quality results if they already returned for the
  same code state
- Otherwise wait for the remaining result

## Code Quality Loop

If the code-quality reviewer reports an issue after spec approval:
- Send the issue to the worker
- Re-run verification after the fix
- Re-review code quality

## Completion Gate

Mark the task complete only when **both reviewers approve the same
code state**. Guardian runs at final review only and must also approve
before close-out. Optimization suggestions are handled by the maester at
close-out — they do not block task completion.

## Integration

Uses `requesting-code-review` as the underlying dispatch primitive.
Reviewers use the prompt templates from
`../subagent-driven-development/`:
- `spec-reviewer-prompt.md`
- `code-quality-reviewer-prompt.md`

The guardian (used at final review only) uses its dedicated system prompt
(`~/.pi/agent/extensions/know-how/agents/guardian.md`).
