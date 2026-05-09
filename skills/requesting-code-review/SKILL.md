---
name: requesting-code-review
description: Use when completing tasks, implementing major features, or before merging to verify work meets requirements
---

# Requesting Code Review

Dispatch the `reviewer` subagent to catch issues before they cascade. The reviewer gets precisely crafted context for evaluation — never your session's history. This keeps the reviewer focused on the work product, not your thought process, and preserves your own context for continued work.

**Core principle:** Review early, review often.

## When to Request Review

**Mandatory:**

- After each task in subagent-driven development
- After completing major feature
- Before merge to main

**Optional but valuable:**

- When stuck (fresh perspective)
- Before refactoring (baseline check)
- After fixing complex bug

## How to Request

**1. Determine the change range:**

If the changes are committed:

```bash
BASE_SHA=$(git rev-parse HEAD~1)  # or origin/main
HEAD_SHA=$(git rev-parse HEAD)
```

If the changes are uncommitted (workers do not commit during execution — this is the
default for SDD and executing-plans workflows):

```bash
# Use the base branch/commit as the diff base
BASE_SHA=$(git merge-base HEAD origin/main 2>/dev/null || echo HEAD~1)
# No HEAD_SHA needed — review the working tree state directly
```

**2. Dispatch reviewer subagent:**

Use the `reviewer` agent via the `subagent` tool. Include the changed files, SHAs or
diff info, and a stop rule — reviewers inspect the diff, not the whole codebase:

For committed changes:

```
subagent({
  agent: "reviewer",
  task: "Review code quality for: [description]. Changed files: [list paths]. BASE_SHA: [sha], HEAD_SHA: [sha]. Inspect the diff and changed files only — do not explore unrelated code. Return findings with file:line references."
})
```

For uncommitted changes (default in SDD/executing-plans workflows):

```
subagent({
  agent: "reviewer",
  task: "Review code quality for: [description]. Changed files: [list paths]. Run `git diff [base_sha]` to see the diff. Inspect the diff and changed files only — do not explore unrelated code. Return findings with file:line references."
})
```

For spec-compliance or code-quality reviews, use the appropriate prompt template:

- Spec compliance: see `../../skills/subagent-driven-development/spec-reviewer-prompt.md`
- Code quality: see `../../skills/subagent-driven-development/code-quality-reviewer-prompt.md`

**Placeholders:**

- `{WHAT_WAS_IMPLEMENTED}` - What you just built
- `{PLAN_OR_REQUIREMENTS}` - What it should do
- `{BASE_SHA}` - Starting commit (or diff base for uncommitted changes)
- `{HEAD_SHA}` - Ending commit (not used for uncommitted changes — reviewers read file state directly)
- `{DIFF}` - Output of `git diff` against the base (for uncommitted changes, replaces BASE_SHA..HEAD_SHA)
- `{DESCRIPTION}` - Brief summary

**3. Act on feedback:**

- Fix Critical issues immediately
- Fix Important issues before proceeding
- Note Minor issues for later
- Push back if reviewer is wrong (with reasoning)

## Example

```
[Just completed Task 2: Add verification function]

You: Let me request code review before proceeding.

BASE_SHA=$(git log --oneline | grep "Task 1" | head -1 | awk '{print $1}')
HEAD_SHA=$(git rev-parse HEAD)

[Dispatch reviewer subagent]
  WHAT_WAS_IMPLEMENTED: Verification and repair functions for conversation index
  PLAN_OR_REQUIREMENTS: Task 2 from ~/.know-how/<project-name>/plans/deployment-plan.md
  DESCRIPTION: Added verifyIndex() and repairIndex() with 4 issue types

[Subagent returns]:
  Strengths: Clean architecture, real tests
  Issues:
    Important: Missing progress indicators
    Minor: Magic number (100) for reporting interval
  Assessment: Ready to proceed

You: [Fix progress indicators]
[Continue to Task 3]
```

## Integration with Workflows

**Subagent-Driven Development:**

- Review after EACH task
- Catch issues before they compound
- Fix before moving to next task

**Executing Plans:**

- Review after each batch (3 tasks)
- Get feedback, apply, continue

**Ad-Hoc Development:**

- Review before merge
- Review when stuck

## Red Flags

**Never:**

- Skip review because "it's simple"
- Ignore Critical issues
- Proceed with unfixed Important issues
- Argue with valid technical feedback

**If reviewer wrong:**

- Push back with technical reasoning
- Show code/tests that prove it works
- Request clarification

See template at: requesting-code-review/code-reviewer.md
