# Guardian Prompt Template

Use this template when dispatching a guardian subagent for per-task code-quality review.

**Purpose:** Dispatch after the controller-owned spec-compliance check.
Let guardian run to completion, then address all findings.

```md
Subagent dispatch: guardian
  Use the `guardian` agent with this template:

  WHAT_WAS_IMPLEMENTED: [summary of changes from implementation]
  PLAN_OR_REQUIREMENTS: Task N from [plan-file]
  DIFF: [output of task_snapshot(action: "diff", taskId: <id>) captured by the controller before dispatching]
  WORK_FROM: [directory set to the worktree path when reviewing worktree-based changes]
  DESCRIPTION: [task summary]
```

The diff is provided inline in the DIFF field above, captured from task_snapshot before this
subagent was dispatched. Do not run git diff yourself.
Review the current file state directly, but constrain findings to the lines represented in `DIFF`.
If `WORK_FROM` is set, resolve file reads against that directory. Untouched legacy issues should be
omitted or marked `*-PREEXISTING`.
Output findings only: no headings, summaries, introductions, conclusions,
praise, or reasoning narration. If there are no findings, output exactly:
`No findings.`
