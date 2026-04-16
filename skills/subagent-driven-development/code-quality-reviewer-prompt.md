# Code Quality Reviewer Prompt Template

Use this template when dispatching a code quality reviewer subagent.

**Purpose:** Verify implementation is well-built (clean, tested, maintainable)

This review may run concurrently with spec compliance review.

Your approval does not complete the task unless spec compliance review also approves the same code state.

If spec compliance review finds an issue for the current code state, the controller may cancel this review or discard its result and restart both reviews after the spec issue is fixed.

Do not request scope-expanding changes. If a possible improvement would add behavior beyond the task or plan, flag it as out of scope instead of requesting implementation.

```
Code-reviewer agent:
  Use template at requesting-code-review/code-reviewer.md

  WHAT_WAS_IMPLEMENTED: [from implementer's report]
  PLAN_OR_REQUIREMENTS: Task N from [plan-file]
  BASE_SHA: [commit before task]
  HEAD_SHA: [current commit]
  DESCRIPTION: [task summary]
```

**In addition to standard code quality concerns, the reviewer should check:**
- Does each file have one clear responsibility with a well-defined interface?
- Are units decomposed so they can be understood and tested independently?
- Is the implementation following the file structure from the plan?
- Did this implementation create new files that are already large, or significantly grow existing files? (Don't flag pre-existing file sizes — focus on what this change contributed.)
- Do any added tests match the plan's `Testing Approach`?

**Code reviewer returns:** Strengths, Issues (Critical/Important/Minor), Assessment
