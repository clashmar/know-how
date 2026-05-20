---
name: subagent-driven-development
description: Use when executing implementation plans with independent tasks in the current session
---

⚠️ HARD GATE — READ THIS BEFORE DOING ANYTHING ELSE ⚠️

This skill requires subagent dispatch for ALL work. Your only job as controller:

1. Read the plan file — ONE read, nothing more
2. Extract task text from what you just read
3. Dispatch workers using the prompt templates in this skill

YOU MUST NOT:

- Read multiple skill files (SDD + executing-plans, etc.)
- Read codebase files to "understand the context"
- Explore project structure
- Research dependencies or APIs
- Implement anything yourself
- Read files sequentially to "prepare"

⚠️ HARD GATE: MAX 3 concurrent subagents ⚠️

THE TEST: If you have typed "read" more than once since SDD was invoked,
you are already violating this skill. STOP. Dispatch.

WHAT TO DO INSTEAD:

- Need to understand the codebase? → Dispatch a bounded scout subagent (see `../dispatching-parallel-agents/scout-prompt.md`). Every scout MUST get: specific files to read, specific questions to answer, a stop boundary, and a conciseness directive. Never dispatch a scout with a vague mandate like "explore the codebase."
- Need context for a task? → Include it in the worker's task description
- Plan file not in context? → READ IT ONCE, then dispatch

The controller orchestrates. Workers read and implement. Never mix these roles.

# Subagent-Driven Development

Execute plan by dispatching a fresh worker subagent per task. After the task's verification steps from the plan pass, dispatch spec-compliance review and code-quality review in parallel. Spec review has precedence: if the spec reviewer finds an issue first, stop waiting for code-quality feedback, cancel or discard the concurrent code-quality review, fix the spec issue, re-run the task's verification steps, and then start both reviews again. Task execution is serial, and a task completes only when both reviewers (spec, code-quality) approve the same code state. The guardian enforces documented conventions at the final whole-implementation review. The maester handles optimization suggestions and process improvement at close-out — these do not block task completion. Follow the plan's declared `Execution Autonomy` exactly. Keep work moving quickly.

**Why subagents:** You delegate tasks to specialized agents with isolated context. By precisely crafting their instructions and context, you ensure they stay focused and succeed at their task. They should never inherit your session's context or history — you construct exactly what they need. This also preserves your own context for coordination work.

**Core principle:** Fresh worker subagent per task + required verification + parallel review + strict plan-contract enforcement = fast feedback with tight scope control.

**This skill REQUIRES subagent dispatch. Do not implement tasks inline. Do not fall back to executing-plans.**

## Pacing

Keep things moving while maintaining quality gates. Instill urgency in
reviewers to review quickly and workers to fix quickly. You are
responsible for keeping things flowing, they are responsible for doing
their part well and quickly. Call out delays and blockers, and keep the
momentum going.

## When to Use

````dot
digraph when_to_use {
    "Have implementation plan?" [shape=diamond];
    "Tasks mostly independent?" [shape=diamond];
    "Stay in this session?" [shape=diamond];
    "subagent-driven-development" [shape=box];
    "Manual execution or plan first" [shape=box];

    "Have implementation plan?" -> "Tasks mostly independent?" [label="yes"];
    "Have implementation plan?" -> "Manual execution or plan first" [label="no"];
    "Tasks mostly independent?" -> "Stay in this session?" [label="yes"];
    "Tasks mostly independent?" -> "Manual execution or plan first" [label="no - tightly coupled"];
    "Stay in this session?" -> "subagent-driven-development" [label="yes"];
    "Stay in this session?" -> "Manual execution or plan first" [label="no"];
}

## The Process

```dot
digraph process {
    rankdir=TB;

    subgraph cluster_per_task {
        label="Per Task";
        "Dispatch worker subagent (./worker-prompt.md)" [shape=box];
        "Worker subagent asks questions?" [shape=diamond];
        "Answer questions, provide context" [shape=box];
        "Worker subagent implements, tests, self-reviews" [shape=box];
        "Task verification steps pass?" [shape=diamond];
        "Worker subagent fixes task verification issues" [shape=box];
        "Dispatch reviewers in parallel: spec compliance and code quality" [shape=box];
        "reviewer — spec compliance (./spec-reviewer-prompt.md) approves?" [shape=diamond];
        "Cancel or discard code-quality review for this code state" [shape=box];
        "Code-quality review result ready?" [shape=diamond];
        "Wait for remaining reviewer results" [shape=box];
        "reviewer — code quality (./code-quality-reviewer-prompt.md) approves?" [shape=diamond];
        "Both reviewers approved?" [shape=diamond];
        "Worker subagent fixes remaining issues" [shape=box];
        "Worker subagent fixes spec issues" [shape=box];
        "Worker subagent fixes code-quality issues" [shape=box];
        "Re-run task verification steps after review fixes" [shape=box];
        "Mark task complete in todo" [shape=box];
        "Execution Autonomy is Checkpointed?" [shape=diamond];
        "Report status and wait for user approval" [shape=box];
    }

    "Read plan, extract all tasks with full text, note context, read Execution Autonomy and Worktree Strategy, create todo items" [shape=box];
    "Worktree Strategy?" [shape=diamond];
    "Create worktree from current branch" [shape=box];
    "Work on current branch" [shape=box];
    "More tasks remain?" [shape=diamond];
    "Dispatch final review: whole-implementation + guardian in parallel" [shape=box];
    "Reviewer — whole implementation approves?" [shape=diamond];
    "Cancel or discard guardian review for this code state" [shape=box];
    "Guardian result ready?" [shape=diamond];
    "Guardian — convention compliance (./guardian-prompt.md) approves?" [shape=diamond];
    "Fix final review issues, re-run relevant verification, and re-review" [shape=box];
    "Worker subagent fixes compliance issues" [shape=box];
    "Use know-how:closing-out-work to close out work, get user review, then choose integration" [shape=box style=filled fillcolor=lightgreen];

    "Read plan, extract all tasks with full text, note context, read Execution Autonomy and Worktree Strategy, create todo items" -> "Worktree Strategy?";
    "Worktree Strategy?" -> "Create worktree from current branch" [label="Worktree"];
    "Worktree Strategy?" -> "Work on current branch" [label="Direct"];
    "Create worktree from current branch" -> "Dispatch worker subagent (./worker-prompt.md)";
    "Work on current branch" -> "Dispatch worker subagent (./worker-prompt.md)";
    "Dispatch worker subagent (./worker-prompt.md)" -> "Worker subagent asks questions?";
    "Worker subagent asks questions?" -> "Answer questions, provide context" [label="yes"];
    "Answer questions, provide context" -> "Dispatch worker subagent (./worker-prompt.md)";
    "Worker subagent asks questions?" -> "Worker subagent implements, tests, self-reviews" [label="no"];
    "Worker subagent implements, tests, self-reviews" -> "Task verification steps pass?";
    "Task verification steps pass?" -> "Worker subagent fixes task verification issues" [label="no"];
    "Worker subagent fixes task verification issues" -> "Worker subagent implements, tests, self-reviews" [label="re-verify"];
    "Task verification steps pass?" -> "Dispatch reviewers in parallel: spec compliance and code quality" [label="yes"];
    "Dispatch reviewers in parallel: spec compliance and code quality" -> "reviewer — spec compliance (./spec-reviewer-prompt.md) approves?";
    "Dispatch reviewers in parallel: spec compliance and code quality" -> "Code-quality review result ready?";
    "reviewer — spec compliance (./spec-reviewer-prompt.md) approves?" -> "Code-quality review result ready?" [label="yes"];
    "reviewer — spec compliance (./spec-reviewer-prompt.md) approves?" -> "Cancel or discard code-quality review for this code state" [label="no"];
    "Cancel or discard code-quality review for this code state" -> "Worker subagent fixes spec issues";
    "Worker subagent fixes spec issues" -> "Re-run task verification steps after review fixes";
    "Code-quality review result ready?" -> "Wait for remaining reviewer results" [label="no"];
    "Wait for remaining reviewer results" -> "Code-quality review result ready?";
    "Code-quality review result ready?" -> "reviewer — code quality (./code-quality-reviewer-prompt.md) approves?" [label="yes"];
    "reviewer — code quality (./code-quality-reviewer-prompt.md) approves?" -> "Both reviewers approved?" [label="yes"];
    "reviewer — code quality (./code-quality-reviewer-prompt.md) approves?" -> "Worker subagent fixes code-quality issues" [label="no"];
    "Worker subagent fixes code-quality issues" -> "Re-run task verification steps after review fixes";
    "Worker subagent fixes remaining issues" -> "Re-run task verification steps after review fixes";
    "Both reviewers approved?" -> "Mark task complete in todo" [label="yes"];
    "Both reviewers approved?" -> "Worker subagent fixes remaining issues" [label="no"];
    "Re-run task verification steps after review fixes" -> "Task verification steps pass?";
    "Mark task complete in todo" -> "Execution Autonomy is Checkpointed?";
    "Execution Autonomy is Checkpointed?" -> "Report status and wait for user approval" [label="yes"];
    "Execution Autonomy is Checkpointed?" -> "More tasks remain?" [label="no"];
    "Report status and wait for user approval" -> "More tasks remain?";
    "More tasks remain?" -> "Dispatch worker subagent (./worker-prompt.md)" [label="yes"];
    "More tasks remain?" -> "Dispatch final review: whole-implementation + guardian in parallel" [label="no"];
    "Dispatch final review: whole-implementation + guardian in parallel" -> "Reviewer — whole implementation approves?";
    "Dispatch final review: whole-implementation + guardian in parallel" -> "Guardian result ready?";
    "Reviewer — whole implementation approves?" -> "Guardian result ready?" [label="yes"];
    "Reviewer — whole implementation approves?" -> "Cancel or discard guardian review for this code state" [label="no"];
    "Cancel or discard guardian review for this code state" -> "Fix final review issues, re-run relevant verification, and re-review";
    "Guardian result ready?" -> "Wait for remaining reviewer results" [label="no"];
    "Wait for remaining reviewer results" -> "Guardian result ready?";
    "Guardian result ready?" -> "Guardian — convention compliance (./guardian-prompt.md) approves?" [label="yes"];
    "Guardian — convention compliance (./guardian-prompt.md) approves?" -> "Use know-how:closing-out-work to close out work, get user review, then choose integration" [label="yes"];
    "Guardian — convention compliance (./guardian-prompt.md) approves?" -> "Worker subagent fixes compliance issues" [label="no"];
    "Worker subagent fixes compliance issues" -> "Fix final review issues, re-run relevant verification, and re-review";
    "Fix final review issues, re-run relevant verification, and re-review" -> "Dispatch final review: whole-implementation + guardian in parallel";
}
````

## Work Environment

See `know-how:worktree-setup` for worktree creation, reuse, fallback,
and `cwd:` configuration.

## Execution Autonomy and Worktree Strategy

Before dispatching Task 1, read the plan's `Execution Autonomy` and `Worktree Strategy` fields.

**Execution Autonomy:**

- `Fully autonomous`: after a task clears required verification, and spec review and code-quality review both approve the same code state, mark it complete and continue to the next task.
- `Checkpointed`: after a task clears required verification, and spec review and code-quality review both approve the same code state, mark it complete, report status, and wait for user approval before starting the next task.

**Worktree Strategy:**

- `Worktree`: create a git worktree from the current branch before starting work. Subagents work in the worktree.
- `Direct`: work directly on the current branch without creating a worktree.

These approval pauses happen after the task's verification and review work are complete. They do not replace the review gates.

If spec review finds an issue, cancel or discard the code-quality review for that code state, fix the spec issue, re-run the task's verification steps, and then start both reviews again.

If code-quality review finds an issue after spec review approves, fix the code-quality issue, re-run the task's verification steps, and then start code-quality review again.

## Review Authority

- spec reviewer authoritative on scope.
- spec review has precedence over code-quality review for the current code state.
- code-quality reviewer must stay within approved scope.
- Guardian enforces documented conventions at the final whole-implementation review — its compliance findings can block close-out; its optimization suggestions are handled by the maester.
- if spec review fails first, cancel or discard the code-quality review results for that code state.
- code-quality feedback only applies after spec review approves the same code state.

## Handling Worker Status

Worker subagents report one of four statuses. Handle each appropriately:

**DONE:** Confirm the task's verification steps passed, then dispatch both reviewers in parallel and watch the spec reviewer first.

**DONE_WITH_CONCERNS:** The worker completed the work but flagged doubts. Read the concerns before proceeding. If the concerns are about correctness or scope, address them before review. If they're observations (e.g., "this file is getting large"), note them and proceed only after the task's required verification has passed.

**NEEDS_CONTEXT:** Treat this as a stop condition for the current run. Surface the missing context to your human partner and wait. Resume only after the human provides the missing context or updates the plan.

**BLOCKED:** Treat this as a stop condition for the current run. Surface the blocker to your human partner and wait. If the human wants work to continue, first get the missing decision, updated plan, or revised scope, then resume from that updated context.

**Never** ignore an escalation or force the same model to retry without changes. If the worker said it's stuck, something needs to change before execution resumes.

## Prompt Templates

- `../dispatching-parallel-agents/scout-prompt.md` - Dispatch scout subagent for bounded reconnaissance
- `./worker-prompt.md` - Dispatch worker subagent
- `./spec-reviewer-prompt.md` - Dispatch reviewer for spec compliance
- `./code-quality-reviewer-prompt.md` - Dispatch reviewer for code quality
- `./guardian-prompt.md` - Dispatch guardian for convention compliance (final review only)

## Per-Task Review Flow

See `know-how:parallel-review` for the parallel dispatch pattern
(spec-first precedence, cancel/discard, loop-until-both-approve). Guardian
runs at final review only.

## Example Workflow

```
You: I'm using Subagent-Driven Development to execute this plan.

[Read plan file once: ~/.know-how/<project-name>/plans/feature-plan.md]
[Read `Execution Autonomy` from the plan]
[Extract all 5 tasks with full text and context]
[Create todo items with all tasks]

Task 1: Hook installation script

[Get Task 1 text and context (already extracted)]
[Dispatch worker subagent with full task text + context]

Worker: "Before I begin - should the hook be installed at user or system level?"

You: "User level (~/.config/hooks/)"

Worker: "Got it. Implementing now..."
[Later] Worker:
  - Implemented install-hook command
  - Added tests, 5/5 passing
  - Self-review: Found I missed --force flag, added it

[Confirm required task verification passed]
[Get git SHAs, Dispatch reviewers — spec compliance and code quality in parallel]
Reviewer (spec compliance): ✅ Spec compliant - all listed requirements implemented, no unrequested behavior or options added
Reviewer (code quality): Strengths: Good test coverage, clean. Issues: None. Approved.

[Mark Task 1 complete]
[If `Execution Autonomy` is `Checkpointed`, report status and wait for user approval]

Task 2: Recovery modes

[Get Task 2 text and context (already extracted)]
[Dispatch worker subagent with full task text + context]

Worker: [No questions, proceeds]
Worker:
  - Added verify/repair modes
  - 8/8 tests passing
  - Self-review: No additional issues found in this pass

[Dispatch reviewers — spec compliance and code quality in parallel]
Reviewer (spec compliance): ❌ Issues:
  - Missing: Progress reporting (spec says "report every 100 items")
  - Extra: Added --json flag (not requested)

Reviewer (code quality): [cancelled or discarded because spec review failed first]

[Stop waiting for code-quality feedback]
[Worker fixes spec issues]
Worker: Removed --json flag and added progress reporting

[Re-run the task's verification steps from the plan]
[Dispatch both reviewers again]
Reviewer (spec compliance): ✅ Spec compliant now
Reviewer (code quality): Strengths: Solid. Issues (Important): Magic number (100)

[Worker fixes code-quality issues]
Worker: Extracted PROGRESS_INTERVAL constant

[Dispatch reviewer for code quality again]
Reviewer (spec compliance): ✅ Spec compliant
Reviewer (code quality): ✅ Approved

[Mark Task 2 complete]

...

[After all tasks]
[Dispatch final review — whole-implementation reviewer and guardian in parallel]
// If a worktree is being used, set `cwd: /path/to/worktree` on the subagent tool call.
// Reviewer reads source files — set cwd to the worktree path if using one.
Reviewer — whole implementation: Requirements satisfied, no blocking issues found.
Guardian — convention compliance: ✅ No compliance violations found.

[If the reviewer finds blocking issues, fix them, re-run relevant verification, and re-review before closing out]

Done!
```

## Advantages

**vs. Manual execution:**

- Subagents follow the plan's testing strategy consistently
- Fresh context per task (no confusion)
- Parallel-safe (subagents don't interfere)
- Subagent can ask questions (before AND during work)

**Efficiency gains:**

- No file reading overhead (controller provides full text)
- Controller curates exactly what context is needed
- Subagent gets complete information upfront
- Questions surfaced before work begins (not after)

**Quality gates:**

- Required verification before review and completion
- Self-review catches issues before handoff
- Parallel review gates
- Review loops ensure fixes actually work
- Final whole-implementation review before closing out work
- Spec compliance prevents over/under-building
- Code quality ensures implementation is well-built
- Standards enforcement by guardian at final review ensures project conventions and personal preferences are consistently applied
- `Checkpointed` mode adds user approval after each completed task

**Cost:**

- More subagent invocations (worker + 2 reviewers per task, + guardian at final review)
- Controller does more prep work (extracting all tasks upfront)
- Review loops add iterations
- But catches issues early (cheaper than debugging later)

## Red Flags

**Never:**

- Instruct workers or subagents to perform git write operations (commit, push, merge, branch, add, stash, checkout --, worktree add/remove, reset). Git writes are gated behind user review — at checkpoints (if `Execution Autonomy: Checkpointed`) and at close-out via closing-out-work. Workers implement, verify, and self-review — they do not commit.
- Treat worktree commits or any git write as “safe” because it’s on a disposable branch. The git write gate applies universally, regardless of branch.
- Make git write operations yourself during execution (stash, checkout --, branch -D, worktree remove). All git integration happens through closing-out-work after user review.
- Start implementation on main/master branch without explicit user consent
- Skip reviews (spec compliance OR code quality)
- Proceed with unfixed issues
- Dispatch multiple implementation subagents in parallel (conflicts)
- Make subagent read plan file (provide full text instead)
- Skip scene-setting context (subagent needs to understand where task fits)
- Ignore subagent questions (answer before letting them proceed)
- Accept "close enough" on spec compliance (spec reviewer found issues = not done)
- Skip review loops (reviewer found issues = worker fixes = review again)
- Let worker self-review replace actual review (both are needed)
- Move to next task before **both** review gates (spec, code-quality) approve the same code state
- Wait for code-quality feedback after spec review already found an issue for the current code state
- Reuse a code-quality result from a code state that spec review rejected
- Ignore the plan's declared `Execution Autonomy` or `Worktree Strategy`
- Continue to the next task in `Checkpointed` mode without user approval
- Treat `NEEDS_CONTEXT` or `BLOCKED` as permission to keep going without your human partner

**If subagent asks questions:**

- Answer clearly and completely
- Provide additional context if needed
- Don't rush them into implementation

**If reviewer finds issues:**

- If spec review finds an issue first, cancel or discard the code-quality review for that code state
- Worker (same subagent) fixes the reported issue
- Re-run the task's verification steps on the updated code
- Start both reviewers again on the updated code state
- If spec review approves and code-quality review finds an issue, fix it and repeat code-quality review
- Don't skip re-reviews

**After the final whole-implementation review:**

- Dispatch a `reviewer` for a whole-implementation sweep and a `guardian` for convention compliance in parallel
- if the whole-implementation reviewer finds blocking issues, cancel/discard the guardian review, fix the issues, re-run the relevant verification, and re-dispatch both
- if the whole-implementation reviewer approves but the guardian finds compliance violations, fix them and re-dispatch the guardian on the updated code state
- do not move to `closing-out-work` until both approve

**In both autonomy modes:**

- do not continue past blockers, missing context, repeated verification failure, a critical plan gap or inconsistency, or user interruption
- do not treat autonomy mode as permission to skip reviews or verification

**If subagent fails task:**

- Dispatch fix subagent with specific instructions
- Don't try to fix manually (context pollution)

## Integration

**Required workflow skills:**

- **know-how:writing-plans** - Creates the plan this skill executes
- **know-how:worktree-setup** - Worktree creation and configuration
- **know-how:parallel-review** - Spec-first parallel review pattern (2 reviewers per-task, guardian at final)
- **know-how:requesting-code-review** - Single-reviewer dispatch primitive
- **know-how:closing-out-work** - Close out after all tasks, get user review, optimize and reflect, then choose integration

**Subagents should use:**

- **know-how:test-driven-development** - When the plan's `Testing Approach` says `TDD Decision: Required`
