# Guardian Prompt Template

Use this template when dispatching a guardian subagent for per-task code-quality review.

**Purpose:** Run the guardian against the current code state after task verification passes.
The guardian reviews code quality grounded in project conventions.

If spec compliance review finds an issue for the current code state, the controller may
discard the guardian result and restart both reviews after the spec issue is fixed.

**CWD note for controllers:** If the code being reviewed is in a worktree, set `cwd: /path/to/worktree`
when dispatching the guardian. The guardian uses `git rev-parse --show-toplevel` to derive the
project name for looking up the right project skill.

```md
Subagent dispatch — guardian:
  Use the `guardian` agent with this template:

  WHAT_WAS_IMPLEMENTED: [summary of changes from implementation]
  PLAN_OR_REQUIREMENTS: Task N from [plan-file]
  DIFF: [output of `git diff` against the base branch or commit]
  WORK_FROM: [directory — set to the worktree path when reviewing worktree-based changes]
  DESCRIPTION: [task summary]
```

Use `git diff` against the base branch/commit to see all changes for this task.
Review the current file state directly. If `WORK_FROM` is set, resolve file
reads against that directory.
