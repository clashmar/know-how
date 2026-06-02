---
name: parallel-review
description: Use when a task passes verification and needs multi-dimensional review before completion
---

# Parallel Review

## Overview

Orchestrates parallel review dispatches: two for per-task (spec compliance, guardian)
with spec-first precedence. Composes `requesting-code-review` as the
underlying dispatch primitive. Used by executing-plans after every task implementation.

## When to Use

- After inline task implementation passes verification
- As part of executing-plans' per-task flow
- When a single code state needs independent verification from spec and
  convention/quality perspectives simultaneously

Not for ad-hoc single-dimension reviews — use requesting-code-review directly for those.

## The Pattern

After a task passes verification, dispatch two subagents in parallel:

1. `reviewer` for spec compliance (use `spec-reviewer-prompt.md`)
2. `guardian` for code quality grounded in project conventions (use `guardian-prompt.md`)

**If a worktree is being used**, set `cwd: /path/to/worktree` on every
subagent dispatch so reviewers resolve paths and git root correctly.

## Spec Precedence

Watch the spec reviewer first:

**If the spec reviewer reports any issue:**
- Stop waiting for guardian feedback
- Cancel the guardian review if it is still running
- Discard its results if already returned
- Fix the spec issues
- Re-run verification after the fix
- Dispatch both reviewers again on the new code state

**If the spec reviewer approves:**
- Use guardian results if they already returned for the same code state
- Otherwise wait for the remaining result

## Guardian Loop

If the guardian reports an issue after spec approval:
- Fix the issue
- Re-run verification after the fix
- Re-review with guardian

## Completion Gate

Mark the task complete only when **both reviewers approve the same
code state**. Guardian runs per-task — every task gets convention and
quality review as it's completed. Optimization suggestions are handled
by the maester at close-out — they do not block task completion.

## Integration

Uses `requesting-code-review` as the underlying dispatch primitive.
Reviewers use the prompt templates from
`../subagent-driven-development/`:
- `spec-reviewer-prompt.md`
- `guardian-prompt.md`
