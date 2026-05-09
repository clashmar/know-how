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

THE TEST: If you have typed "read" more than once since SDD was invoked,
you are already violating this skill. STOP. Dispatch.

WHAT TO DO INSTEAD:
- Need to understand the codebase? → Dispatch a scout subagent
- Need context for a task? → Include it in the worker's task description
- Plan file not in context? → READ IT ONCE, then dispatch

The controller orchestrates. Workers read and implement. Never mix these roles.

# Subagent-Driven Development

Execute plan by dispatching a fresh worker subagent per task. After the task's verification steps from the plan pass, dispatch spec-compliance review, code-quality review, and standards-guardian review in parallel. Spec review has precedence: if the spec reviewer finds an issue first, stop waiting for code-quality and guardian feedback, cancel or discard the concurrent code-quality and guardian reviews, fix the spec issue, re-run the task's verification steps, and then start all three reviews again. Task execution is serial, and a task completes only when all three reviewers (spec, code-quality, standards-guardian) approve the same code state. The standards-guardian also logs optimization suggestions to improve project conventions — these are surfaced at close-out and do not block task completion. Follow the plan's declared `Execution Autonomy` exactly. Keep work moving quickly.

**Why subagents:** You delegate tasks to specialized agents with isolated context. By precisely crafting their instructions and context, you ensure they stay focused and succeed at their task. They should never inherit your session's context or history — you construct exactly what they need. This also preserves your own context for coordination work.

**Core principle:** Fresh worker subagent per task + required verification + parallel review + strict plan-contract enforcement = fast feedback with tight scope control.

**This skill REQUIRES subagent dispatch. Do not implement tasks inline. Do not fall back to executing-plans.**

## Agent Mapping

Every subagent dispatch point in this skill maps to a specific pi agent:

| Role                              | pi Agent             |
| --------------------------------- | -------------------- |
| Worker per task                   | `worker`             |
| Spec compliance review            | `reviewer`           |
| Code quality review               | `reviewer`           |
| Standards enforcement             | `standards-guardian` |
| Final whole-implementation review | `reviewer`           |

The `worker` agent handles implementation with forked context. The `reviewer` agent handles reviews with spec compliance or code quality prompt templates. The `standards-guardian` agent enforces documented project conventions using its dedicated system prompt (see `agents/standards-guardian.md`).

<IMPORTANT>
Keep things moving while maintaining quality gates. Instill urgency in reviewers to review quickly and workers to fix quickly. You are responsible for keeping things flowing, they are responsible for doing their part well and quickly. Call out delays and blockers, and keep the momentum going.
<IMPORTANT>

## When to Use

````dot
digraph when_to_use {
    "Have implementation plan?" [shape=diamond];
    "Tasks mostly independent?" [shape=diamond];
    "Stay in this session?" [shape=diamond];
    "subagent-driven-development" [shape=box];
    "Manual execution or brainstorm first" [shape=box];

    "Have implementation plan?" -> "Tasks mostly independent?" [label="yes"];
    "Have implementation plan?" -> "Manual execution or brainstorm first" [label="no"];
    "Tasks mostly independent?" -> "Stay in this session?" [label="yes"];
    "Tasks mostly independent?" -> "Manual execution or brainstorm first" [label="no - tightly coupled"];
    "Stay in this session?" -> "subagent-driven-development" [label="yes"];
    "Stay in this session?" -> "Manual execution or brainstorm first" [label="no"];
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
        "Dispatch reviewers in parallel: spec compliance, code quality, and standards-guardian" [shape=box];
        "reviewer — spec compliance (./spec-reviewer-prompt.md) approves?" [shape=diamond];
        "Cancel or discard code-quality and guardian reviews for this code state" [shape=box];
        "Code-quality review result ready?" [shape=diamond];
        "Wait for remaining reviewer results" [shape=box];
        "reviewer — code quality (./code-quality-reviewer-prompt.md) approves?" [shape=diamond];
        "standards-guardian result ready?" [shape=diamond];
        "standards-guardian approves?" [shape=diamond];
        "All reviewers approved?" [shape=diamond];
        "Worker subagent fixes remaining issues" [shape=box];
        "Worker subagent fixes spec issues" [shape=box];
        "Worker subagent fixes code-quality issues" [shape=box];
        "Worker subagent fixes compliance issues" [shape=box];
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
    "Dispatch final reviews in parallel" [shape=box];
    "Reviewer — whole implementation approves?" [shape=diamond];
    "standards-guardian — whole implementation approves?" [shape=diamond];
    "Fix final review issues, re-run relevant verification, and re-review" [shape=box];
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
    "Task verification steps pass?" -> "Dispatch reviewers in parallel: spec compliance, code quality, and standards-guardian" [label="yes"];
    "Dispatch reviewers in parallel: spec compliance, code quality, and standards-guardian" -> "reviewer — spec compliance (./spec-reviewer-prompt.md) approves?";
    "Dispatch reviewers in parallel: spec compliance, code quality, and standards-guardian" -> "Code-quality review result ready?";
    "Dispatch reviewers in parallel: spec compliance, code quality, and standards-guardian" -> "standards-guardian result ready?";
    "reviewer — spec compliance (./spec-reviewer-prompt.md) approves?" -> "Code-quality review result ready?" [label="yes"];
    "reviewer — spec compliance (./spec-reviewer-prompt.md) approves?" -> "Cancel or discard code-quality and guardian reviews for this code state" [label="no"];
    "Cancel or discard code-quality and guardian reviews for this code state" -> "Worker subagent fixes spec issues";
    "Worker subagent fixes spec issues" -> "Re-run task verification steps after review fixes";
    "Code-quality review result ready?" -> "Wait for remaining reviewer results" [label="no"];
    "Wait for remaining reviewer results" -> "Code-quality review result ready?";
    "Code-quality review result ready?" -> "reviewer — code quality (./code-quality-reviewer-prompt.md) approves?" [label="yes"];
    "standards-guardian result ready?" -> "Wait for remaining reviewer results" [label="no"];
    "Wait for remaining reviewer results" -> "standards-guardian result ready?";
    "standards-guardian result ready?" -> "standards-guardian approves?" [label="yes"];
    "reviewer — code quality (./code-quality-reviewer-prompt.md) approves?" -> "All reviewers approved?" [label="yes"];
    "reviewer — code quality (./code-quality-reviewer-prompt.md) approves?" -> "Worker subagent fixes code-quality issues" [label="no"];

    "standards-guardian approves?" -> "All reviewers approved?" [label="yes"];
    "standards-guardian approves?" -> "Worker subagent fixes compliance issues" [label="no"];
    "Worker subagent fixes code-quality issues" -> "Re-run task verification steps after review fixes";
    "Worker subagent fixes compliance issues" -> "Re-run task verification steps after review fixes";
    "Worker subagent fixes remaining issues" -> "Re-run task verification steps after review fixes";
    "All reviewers approved?" -> "Mark task complete in todo" [label="yes"];
    "All reviewers approved?" -> "Worker subagent fixes remaining issues" [label="no"];
    "Re-run task verification steps after review fixes" -> "Task verification steps pass?";
    "Mark task complete in todo" -> "Execution Autonomy is Checkpointed?";
    "Execution Autonomy is Checkpointed?" -> "Report status and wait for user approval" [label="yes"];
    "Execution Autonomy is Checkpointed?" -> "More tasks remain?" [label="no"];
    "Report status and wait for user approval" -> "More tasks remain?";
    "More tasks remain?" -> "Dispatch worker subagent (./worker-prompt.md)" [label="yes"];
    "More tasks remain?" -> "Dispatch final reviews in parallel" [label="no"];
    "Dispatch final reviews in parallel" -> "Reviewer — whole implementation approves?";
    "Dispatch final reviews in parallel" -> "standards-guardian — whole implementation approves?";
    "Reviewer — whole implementation approves?" -> "Fix final review issues, re-run relevant verification, and re-review" [label="no"];
    "Reviewer — whole implementation approves?" -> "standards-guardian — whole implementation approves?" [label="yes"];
    "standards-guardian — whole implementation approves?" -> "Fix final review issues, re-run relevant verification, and re-review" [label="no"];
    "standards-guardian — whole implementation approves?" -> "Use know-how:closing-out-work to close out work, get user review, then choose integration" [label="yes"];
    "Fix final review issues, re-run relevant verification, and re-review" -> "Dispatch final reviews in parallel";
}
````

## Set Up Work Environment

Read the plan's declared `Worktree Strategy` and follow it exactly.

### If `Worktree Strategy: Worktree`

Before dispatching any subagents, create a git worktree **from the current branch**. The controller orchestrates from the original session but subagents work in the isolated checkout:

```bash
# 1. Note where you are
CURRENT_BRANCH=$(git branch --show-current)
REPO_ROOT=$(git rev-parse --show-toplevel)

# 2. Check the working tree is clean
git status --porcelain
# If dirty: "Working tree has uncommitted changes. Stash and proceed, or abort?"

# 3. Derive a worktree branch name from the plan
#    e.g. plan title "Add Auth Refactor" → branch: "feature-auth-refactor"

# 4. Create the worktree from the current branch
git worktree add ../<project>-<feature> -b <feature-branch> $CURRENT_BRANCH
```

Each subagent task includes `cwd: /path/to/worktree` so they edit files there.
Commits happen in the worktree. The original checkout stays untouched.

**If a worktree for this branch already exists**, reuse it.

### If `Worktree Strategy: Direct`

Work directly on the current branch. No worktree setup needed. Subagents work in the current checkout.

### If the repo can't support worktrees (bare repo, submodule)

Fall back to working on the current branch regardless of the plan's Worktree Strategy.

## Execution Autonomy and Worktree Strategy

Before dispatching Task 1, read the plan's `Execution Autonomy` and `Worktree Strategy` fields.

**Execution Autonomy:**

- `Fully autonomous`: after a task clears required verification, and spec review, code-quality review, and standards-guardian all approve the same code state, mark it complete and continue to the next task.
- `Checkpointed`: after a task clears required verification, and spec review, code-quality review, and standards-guardian all approve the same code state, mark it complete, report status, and wait for user approval before starting the next task.

**Worktree Strategy:**

- `Worktree`: create a git worktree from the current branch before starting work. Subagents work in the worktree.
- `Direct`: work directly on the current branch without creating a worktree.

These approval pauses happen after the task's verification and review work are complete. They do not replace the review gates.

If spec review finds an issue, cancel or discard the code-quality review and standards-guardian review for that code state, fix the spec issue, re-run the task's verification steps, and then start all three reviews again.

If code-quality review finds an issue after spec review approves, fix the code-quality issue, re-run the task's verification steps, and then start code-quality review and standards-guardian review again.

Guardian optimization log entries for cancelled reviews are preserved — the gap was still observed.

## Review Authority

- spec reviewer authoritative on scope.
- spec review has precedence over code-quality review and standards-guardian for the current code state.
- code-quality reviewer must stay within approved scope.
- standards-guardian enforces documented conventions — its compliance findings can block task completion; its optimization suggestions are logged silently.
- if spec review fails first, cancel or discard the code-quality and standards-guardian review results for that code state.
- code-quality and standards-guardian feedback only apply after spec review approves the same code state.

## Handling Worker Status

Worker subagents report one of four statuses. Handle each appropriately:

**DONE:** Confirm the task's verification steps passed, then dispatch all three reviewers in parallel and watch the spec reviewer first.

**DONE_WITH_CONCERNS:** The worker completed the work but flagged doubts. Read the concerns before proceeding. If the concerns are about correctness or scope, address them before review. If they're observations (e.g., "this file is getting large"), note them and proceed only after the task's required verification has passed.

**NEEDS_CONTEXT:** Treat this as a stop condition for the current run. Surface the missing context to your human partner and wait. Resume only after the human provides the missing context or updates the plan.

**BLOCKED:** Treat this as a stop condition for the current run. Surface the blocker to your human partner and wait. If the human wants work to continue, first get the missing decision, updated plan, or revised scope, then resume from that updated context.

**Never** ignore an escalation or force the same model to retry without changes. If the worker said it's stuck, something needs to change before execution resumes.

## Prompt Templates

- `./worker-prompt.md` - Dispatch worker subagent
- `./spec-reviewer-prompt.md` - Dispatch reviewer for spec compliance
- `./code-quality-reviewer-prompt.md` - Dispatch reviewer for code quality

## Per-Task Review Flow

1. Run the task's verification steps from the plan.
2. Dispatch three subagents in parallel:
   - `reviewer` for spec compliance
   - `reviewer` for code quality
   - `standards-guardian` for project-standards enforcement
3. Watch the spec reviewer first.
4. If the spec reviewer reports any issue:
   - stop waiting for code-quality and guardian feedback
   - cancel the code-quality and guardian reviews if they are still running
   - discard their results if already returned
   - send the spec issues to the worker
   - re-run the task's verification steps after the fix
   - dispatch all three reviewers again on the new code state
5. If the spec reviewer approves:
   - use the code-quality and guardian results if they already returned for the same code state
   - otherwise wait for the remaining results
6. If the code-quality reviewer reports an issue after spec approval:
   - send the issue to the worker
   - re-review code quality
   - the standards-guardian is also re-dispatched with the updated code state
7. Mark the task complete only when all three reviewers approve the same code
   state. Guardian's optimization suggestions are logged silently — they do not
   block task completion.

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
[Get git SHAs, Dispatch reviewers — spec compliance, code quality, and standards-guardian in parallel]
Reviewer (spec compliance): ✅ Spec compliant - all listed requirements implemented, no unrequested behavior or options added
Reviewer (code quality): Strengths: Good test coverage, clean. Issues: None. Approved.
Standards guardian: ✅ No compliance violations found. Optimization suggestions logged.

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

[Dispatch reviewers — spec compliance, code quality, and standards-guardian in parallel]
Reviewer (spec compliance): ❌ Issues:
  - Missing: Progress reporting (spec says "report every 100 items")
  - Extra: Added --json flag (not requested)

Reviewer (code quality + guardian): [cancelled or discarded because spec review failed first]

[Stop waiting for code-quality feedback]
[Worker fixes spec issues]
Worker: Removed --json flag and added progress reporting

[Re-run the task's verification steps from the plan]
[Dispatch all three reviewers again]
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
[Dispatch final reviews in parallel — reviewer (whole implementation) + standards-guardian]
Reviewer — whole implementation: Requirements satisfied, no blocking issues found.
Standards guardian: Compliance sweep passed. Optimization suggestions surfaced at close-out.

[If either reviewer finds blocking issues, fix them, re-run relevant verification, and re-review before closing out]

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
- Final whole-implementation review and standards-guardian sweep before closing out work
- Spec compliance prevents over/under-building
- Code quality ensures implementation is well-built
- Standards enforcement ensures project conventions and personal preferences are consistently applied
- `Checkpointed` mode adds user approval after each completed task

**Cost:**

- More subagent invocations (worker + 3 reviewers per task)
- Controller does more prep work (extracting all tasks upfront)
- Review loops add iterations
- But catches issues early (cheaper than debugging later)

## Red Flags

**Never:**

- Start implementation on main/master branch without explicit user consent
- Skip reviews (spec compliance, code quality, OR standards-guardian)
- Proceed with unfixed issues
- Dispatch multiple implementation subagents in parallel (conflicts)
- Make subagent read plan file (provide full text instead)
- Skip scene-setting context (subagent needs to understand where task fits)
- Ignore subagent questions (answer before letting them proceed)
- Accept "close enough" on spec compliance (spec reviewer found issues = not done)
- Skip review loops (reviewer found issues = worker fixes = review again)
- Let worker self-review replace actual review (both are needed)
- Move to next task before **all** review gates (spec, code-quality, standards-guardian) approve the same code state
- Wait for code-quality or guardian feedback after spec review already found an issue for the current code state
- Reuse a code-quality or guardian result from a code state that spec review rejected
- Ignore the plan's declared `Execution Autonomy` or `Worktree Strategy`
- Continue to the next task in `Checkpointed` mode without user approval
- Treat `NEEDS_CONTEXT` or `BLOCKED` as permission to keep going without your human partner

**If subagent asks questions:**

- Answer clearly and completely
- Provide additional context if needed
- Don't rush them into implementation

**If reviewer finds issues:**

- If spec review finds an issue first, cancel or discard the code-quality and standards-guardian reviews for that code state
- Worker (same subagent) fixes the reported issue
- Re-run the task's verification steps on the updated code
- Start all three reviewers again on the updated code state
- If spec review approves and code-quality review finds an issue, fix it, repeat code quality review, and re-dispatched standards-guardian with the updated code state
- If spec review approves and standards-guardian finds a compliance violation, fix it, re-run verification, and dispatch all three reviewers again
- Don't skip re-reviews

**After the final whole-implementation review:**

- Final reviews are dispatched in parallel: `reviewer` for whole-implementation sweep and `standards-guardian` for final project-standards compliance sweep
- both must approve the same code state
- if blocking issues are found by either reviewer, fix them
- re-run the relevant verification on the updated code
- send the whole implementation back for both final reviews again
- do not move to `closing-out-work` until both reviewers approve

**In both autonomy modes:**

- do not continue past blockers, missing context, repeated verification failure, a critical plan gap or inconsistency, or user interruption
- do not treat autonomy mode as permission to skip reviews or verification

**If subagent fails task:**

- Dispatch fix subagent with specific instructions
- Don't try to fix manually (context pollution)

## Integration

**Required workflow skills:**

- **know-how:writing-plans** - Creates the plan this skill executes
- **know-how:requesting-code-review** - Code review template for reviewer subagents
- **know-how:closing-out-work** - Close out work after all tasks, get user review, then choose integration

**Subagents should use:**

- **know-how:test-driven-development** - Use when the plan's `Testing Approach` says `TDD Decision: Required`
