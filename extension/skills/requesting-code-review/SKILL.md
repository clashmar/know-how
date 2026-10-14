---
name: requesting-code-review
description: Use when completing tasks, implementing major features, or before merging to verify work meets requirements
---
⚠️ HARD GATE: MAX 3 concurrent subagents ⚠️

# Requesting Code Review

Dispatch the `guardian` subagent to catch convention and code-quality issues before they cascade. Handle spec-compliance and scope checks in the controller using the task requirements, diff, and verification evidence.

**Core principle:** Review early, review often.

## When to Request Review

**Mandatory:**

- After each task in executing-plans
- After completing major feature
- Before merge to main

**Optional but valuable:**

- When stuck (fresh perspective)
- Before refactoring (baseline check)
- After fixing complex bug

## How to Request

**1. Determine the diff:**

If `task_snapshot` was used (default in executing-plans workflows):
The controller called `task_snapshot(action: "diff", taskId: <id>)` and captured `DIFF` before
requesting review. Pass `DIFF` as literal diff text in the guardian task string - no git commands needed.

If `task_snapshot` was not used (fallback):

For committed changes:

```bash
BASE_SHA=$(git rev-parse HEAD~1)  # or origin/main
HEAD_SHA=$(git rev-parse HEAD)
```

For uncommitted changes:

```bash
# Use the base branch/commit as the diff base
BASE_SHA=$(git merge-base HEAD origin/main 2>/dev/null || echo HEAD~1)
# No HEAD_SHA needed - review the working tree state directly
```

**2. Run the controller-owned spec check:**

Before dispatching guardian, answer these against the requirements and diff:

- Did the implementation cover the requested behavior?
- Did it avoid unrequested feature work or refactors?
- Did it follow the planned testing approach?
- Is the verification evidence sufficient?

If any answer is unclear, stop and resolve that first.

**3. Dispatch guardian subagent:**

Use `../../skills/executing-plans/guardian-prompt.md` as the single source of truth for guardian handoff.
Populate that template with:

- `{WHAT_WAS_IMPLEMENTED}` - What you just built
- `{PLAN_OR_REQUIREMENTS}` - What it should do
- `{DESCRIPTION}` - Brief summary
- `{WORK_FROM}` - Working directory or worktree path
- `{DIFF}` - The task diff text

When `task_snapshot` is available, use its `DIFF` output directly.
When `task_snapshot` is not available, compute the diff in the controller with `git diff [base_sha]` and paste that output into `{DIFF}` before dispatching guardian.

**4. Act on feedback:**

- Fix MUST_FIX issues immediately
- Fix SHOULD_FIX issues before proceeding
- Note OBSERVATION items for later judgment
- Push back if guardian is wrong (with reasoning)

## Example

```
[Just completed Task 2: Add verification function]

You: Let me request code review before proceeding.

BASE_SHA=$(git log --oneline | grep "Task 1" | head -1 | awk '{print $1}')
HEAD_SHA=$(git rev-parse HEAD)

[Run controller spec check]
  WHAT_WAS_IMPLEMENTED: Verification and repair functions for conversation index
  PLAN_OR_REQUIREMENTS: Task 2 from ~/.know-how/<project-name>/plans/deployment-plan.md
  DESCRIPTION: Added verifyIndex() and repairIndex() with 4 issue types

[Dispatch guardian subagent]

[Subagent returns]:
  Issues:
    MUST_FIX: Missing progress indicators
    OBSERVATION: Magic number (100) for reporting interval

You: [Fix progress indicators]
[Continue to Task 3]
```

## Integration with Workflows

**Subagent-Driven Development:**

- Review after EACH task
- Catch issues before they compound
- Fix before moving to next task

**Executing Plans:**

- Run the controller spec check after each task using the `task_snapshot`-produced `DIFF` when available
- Dispatch guardian
- Apply feedback, then continue

**Ad-Hoc Development:**

- Review before merge
- Review when stuck

## Red Flags

**Never:**

- Skip review because "it's simple"
- Ignore MUST_FIX issues
- Proceed with unfixed SHOULD_FIX issues
- Argue with valid technical feedback

**If guardian is wrong:**

- Push back with technical reasoning
- Show code/tests that prove it works
- Request clarification
