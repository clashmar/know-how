# Guardian Reviewer Prompt Template

Use this template when dispatching a guardian reviewer subagent.

**Purpose:** Run the guardian against the current task's code state after task verification passes.

If spec compliance review finds an issue for the current code state, the controller may cancel this review or discard its result and restart reviews after the spec issue is fixed.

**CWD note for controllers:** If the code being reviewed is in a worktree, set `cwd: /path/to/worktree` when dispatching the guardian.
The guardian uses `git rev-parse --show-toplevel` to derive the project name for looking up the right project skill, reflections, and optimization log.

```md
Subagent dispatch — guardian reviewer:
  Use the `guardian` agent with this template:

  WHAT_WAS_IMPLEMENTED: [from worker's report]
  PLAN_OR_REQUIREMENTS: Task N from [plan-file]
  DIFF: [output of `git diff` against the base branch or commit]
  WORK_FROM: [directory — set to the worktree path when reviewing worktree-based changes]
  DESCRIPTION: [task summary]
```

Use `git diff` against the base branch/commit to see all changes for this task.
Review the current file state directly. If `WORK_FROM` is set, resolve file
reads against that directory.
