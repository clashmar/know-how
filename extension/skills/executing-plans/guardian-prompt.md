# Guardian Prompt Template

Use this template when dispatching a guardian subagent for per-task code-quality review.

**Purpose:** Run the guardian against the current code state after task verification passes.
The guardian reviews code quality grounded in project conventions. Dispatch in parallel
with the spec-compliance reviewer — let both run to completion, then address all findings.

**CWD note for controllers:** If the code being reviewed is in a worktree, set `cwd: /path/to/worktree`
when dispatching the guardian. The guardian uses `git rev-parse --show-toplevel` to derive the
project name for looking up the right project skill.

```md
Subagent dispatch — guardian:
  Use the `guardian` agent with this template:

  WHAT_WAS_IMPLEMENTED: [summary of changes from implementation]
  PLAN_OR_REQUIREMENTS: Task N from [plan-file]
  DIFF: [output of task_snapshot(action: "diff", taskId: <id>) — captured by the controller before dispatching]
  WORK_FROM: [directory — set to the worktree path when reviewing worktree-based changes]
  DESCRIPTION: [task summary]
```

The diff is provided inline in the DIFF field above — captured from task_snapshot before this
subagent was dispatched. Do not run git diff yourself.
Review the current file state directly. If `WORK_FROM` is set, resolve file
reads against that directory.
