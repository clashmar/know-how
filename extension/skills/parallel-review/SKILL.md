---
name: parallel-review
description: Use when a task passes verification and needs multi-dimensional review before completion
---

# Parallel Review

## Overview

Orchestrates three simultaneous review dispatches (spec compliance, code quality,
guardian) with spec-first precedence. Composes `requesting-code-review` as the
underlying dispatch primitive. Used by SDD after every task implementation.

## When to Use

- After a worker reports DONE and task verification passes
- As part of SDD's per-task flow
- When a single code state needs independent verification from spec, quality, and
  standards perspectives simultaneously

Not for ad-hoc single-dimension reviews — use requesting-code-review directly for those.

## The Pattern

After a task passes verification, dispatch three subagents in parallel
(all with `context: "fresh"`):

1. `reviewer` for spec compliance (use `spec-reviewer-prompt.md`)
2. `reviewer` for code quality (use `code-quality-reviewer-prompt.md`)
3. `guardian` for project-standards enforcement

**If a worktree is being used**, set `cwd: /path/to/worktree` on every
subagent dispatch so reviewers and guardian resolve paths and git root
correctly.

## Spec Precedence

Watch the spec reviewer first:

**If the spec reviewer reports any issue:**
- Stop waiting for code-quality and guardian feedback
- Cancel the code-quality and guardian reviews if they are still running
- Discard their results if already returned
- Send the spec issues to the worker
- Re-run verification after the fix
- Dispatch all three reviewers again on the new code state

**If the spec reviewer approves:**
- Use code-quality and guardian results if they already returned for the
  same code state
- Otherwise wait for the remaining results

## Code Quality Loop

If the code-quality reviewer reports an issue after spec approval:
- Send the issue to the worker
- Re-run verification after the fix
- Re-review code quality
- Re-dispatch the guardian with the updated code state

## Completion Gate

Mark the task complete only when **all three reviewers approve the same
code state**. Optimization suggestions are handled by the maester at
close-out — they do not block task completion.

## Integration

Uses `requesting-code-review` as the underlying dispatch primitive.
Reviewers use the prompt templates from
`../subagent-driven-development/`:
- `spec-reviewer-prompt.md`
- `code-quality-reviewer-prompt.md`

The guardian uses its dedicated system prompt
(`~/.pi/agent/agents/guardian.md`).
