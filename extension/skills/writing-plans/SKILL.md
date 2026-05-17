---
name: writing-plans
description: Use when you have a spec or requirements for a multi-step task, before touching code
---

# Writing Plans

## Overview

Write comprehensive implementation plans assuming the engineer is completely new to our codebase. Document everything they need to know: which files to touch for each task, code, testing, docs they might need to check, how to test it. Give them the whole plan as bite-sized tasks. DRY. YAGNI. Make the testing strategy explicit and binding.

Assume they are a skilled developer, but know almost nothing about our toolset or problem domain. They thrive when given explicit expectations for testing and test design.

**Announce at start:** "I'm using the writing-plans skill to create the implementation plan."

**Context:** This should be run in the current workspace unless the user explicitly asks for a different setup.

**Save plans to:** `~/.know-how/<project-name>/plans/YYYY-MM-DD-<feature-name>.md`

- Derive `<project-name>` from the git repository root (`git rev-parse --show-toplevel`) basename, lowercased with non-alphanumeric runs replaced by hyphens.
- If `~/.know-how/<project-name>/` does not exist, use `present_choice` to offer: create it, use another path, or skip (write the plan inline to the current context).
- User preferences for plan location override this default.
- If the controller is still in read mode, use the shared write-mode approval prompt before saving the plan file (see Execution Handoff section).

## Core Rule

Decide the testing strategy before writing tasks.

The plan MUST explicitly state:

- whether TDD is required or manual only
- which behaviors need automated coverage
- which changes should be verified manually
- whether execution style is `Subagent-Driven` or `Inline Execution`
- whether execution is `Fully autonomous` or `Checkpointed`
- whether to work in a `Worktree` or `Direct` on the current branch

## Testing Strategy Decision

Every plan MUST include a short `Testing Approach` section near the top.

Use this decision model:

### TDD Required

Use TDD when the plan should call for automated tests because the work has meaningful logic risk, including:

- bug fixes with a reproducible failure
- business rules and validation
- state transitions
- parsers, transformers, and calculations
- code with tricky edge cases or regression risk
- specific integration paths where the plan names an automated test worth adding

### Manual Only

Use manual verification and targeted checks when the plan should not call for automated tests, including:

- color, spacing, typography, and layout polish
- content or copy edits
- low-risk UI tweaks with no logic change
- simple config changes
- setup and install flows better verified against a real local environment
- integration work where the plan can be verified reliably without adding automated tests
- codebases where the user explicitly does not want automated tests for this work

Once the plan is written, the implementer must follow the `Testing Approach` exactly.
`Manual only` means do not add automated tests.
`Required` means add the automated tests the plan calls for and use strict TDD for them.

### Tests To Avoid

Plans should explicitly avoid brittle, low-value tests such as:

- exact button width checks
- exact color assertions when color is not a contract
- typography-only assertions
- giant unit tests for cosmetic-only behavior
- tests that mostly lock in implementation details

### Observability & Manual Verification

Every plan must specify how the result will be verified without relying solely
on automated tests. Manual verification makes changes reviewable and testable
by someone who wasn't in the implementation session.

Include at least one observable verification command or check for the work
as a whole. Choose the category that fits:

- **Data/logic changes:** Include a logging command, debug output, or assertion
  that a reviewer can run to see the expected outcome.
  *Example: `RUST_LOG=debug cargo run -- --process-file input.json | grep "processed:"`*

- **UI/visual changes:** Describe what to look for — which elements, positions,
  colors, interactions. Be specific enough that someone unfamiliar with the
  feature can verify it.
  *Example: "The save button is now disabled when the form is empty. Expected:
  greyed out, not clickable."*

- **API/service changes:** Provide exact curl/HTTPie/gRPCurl commands with the
  expected response body or status code.
  *Example: `curl -X POST http://localhost:8080/api/items -d '{"name":"test"}' | jq '.id'`*

- **Config/environment changes:** Show the expected diff or validation command.
  *Example: `diff expected-config.yaml actual-config.yaml` or
  `cargo check 2>&1 | grep -i "error"`*

If a change cannot be observed without automation (no visual feedback, no CLI
output, no API), add a logging or instrumentation step to the implementation.
The rule: a reviewer who wasn't in the session should be able to independently
verify correctness.

## Scope Check

If the spec covers multiple independent subsystems, it should have been broken into sub-project specs during planning. If it wasn't, suggest breaking this into separate plans — one per subsystem. Each plan should produce working, testable software on its own.

## File Structure

Before defining tasks, map out which files will be created or modified and what each one is responsible for. This is where decomposition decisions get locked in.

- Design units with clear boundaries and well-defined interfaces. Each file should have one clear responsibility.
- You reason best about code you can hold in context at once, and your edits are more reliable when files are focused. Prefer smaller, focused files over large ones that do too much.
- Files that change together should live together. Split by responsibility, not by technical layer.
- In existing codebases, follow established patterns. If the codebase uses large files, don't unilaterally restructure - but if a file you're modifying has grown unwieldy, including a split in the plan is reasonable.

This structure informs the task decomposition. Each task should produce self-contained changes that make sense independently.

## Bite-Sized Task Granularity

Each step should be one concrete action, usually 2-5 minutes.

For `Required` work, use TDD-shaped steps such as:

- "Write the failing test" - step
- "Run it to make sure it fails" - step
- "Implement the minimal code to make the test pass" - step
- "Run the tests and make sure they pass" - step

For `Manual only` work, use verification-shaped steps such as:

- "Implement the requested change" - step
- "Run the targeted command or workflow" - step
- "Confirm the listed manual checks pass" - step

Use only the steps the chosen testing strategy actually needs.

## Worktree Strategy

Every plan MUST declare whether work happens in a worktree or directly on the current branch.

Use this decision model:

### Worktree

Use a worktree when the plan will modify production-like code that should be isolated:

- any implementation that could need rollback
- work that will be reviewed before merge
- parallel agent dispatch where agents touch different files
- any plan where keeping the original checkout clean matters

### Direct

Work directly on the current branch when the changes are low-risk or don't benefit from isolation:

- docs-only or config-only changes
- quick fixes where rollback is trivial
- repos that don't support worktrees
- the user explicitly prefers working on the current branch

The worktree, when chosen, is always created from the current branch — not from main. This means if you're on a feature branch, the worktree branches from that feature branch.

The worktree directory is named the same as the branch for simplicity (e.g. `<project-name>-auth-refactor` → worktree at `../<project-name>-auth-refactor`). Prepend the project name (derived from the git root directory name) so worktrees identify their repo at a glance. Only one name to remember.

## Execution Options

Every plan MUST declare the execution style, execution autonomy, and worktree strategy that will be used during implementation. These decisions are made after the plan is written, just before the final plan is saved and handed off for execution.

## Plan Document Header

**Every plan MUST start with this header:**

```markdown
# [Feature Name] Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use know-how:subagent-driven-development or know-how:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** [One sentence describing what this builds]

**Architecture:** [2-3 sentences about approach]

**Tech Stack:** [Key technologies/libraries]

**Execution Style:** Subagent-Driven | Inline Execution

**Execution Autonomy:** Fully autonomous | Checkpointed

**Worktree Strategy:** Worktree | Direct

## Testing Approach

**TDD Decision:** Required | Manual only

Follow this exactly during implementation.
If the decision is `Manual only`, do not add automated tests.
If the decision is `Required`, write the failing test first and follow TDD strictly.

**Manual verification:**

- Observable verification command or check (see Observability section above)
- [any additional task-specific checks]

---

### Task N+1: Close Out

**Review gate:**

- [ ] **Whole-implementation reviewer:** comprehensive sweep

**Optimization:**

- [ ] Present optimization suggestions
- [ ] `/reflect`
- [ ] Approve, edit, or skip each suggestion
- [ ] Apply agreed doc/memory/skill changes

**Cleanup:**

- [ ] Sweep for residual artifacts (temp files, dead code, stale comments)
- [ ] Verify project docs are up to date

**Verification:**

- [ ] Run full project verification

**Integrate:**

- [ ] Human confirms work is ready
- [ ] Commit / PR / keep as-is
```

## Task Structure When TDD Is Required

````markdown
### Task N: [Component Name]

**Files:**

- Create: `exact/path/to/file.py`
- Modify: `exact/path/to/existing.py:123-145`
- Test: `tests/exact/path/to/test.py`

- [ ] **Step 1: Write the failing test**

```python
def test_specific_behavior():
    result = function(input)
    assert result == expected
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/path/test.py::test_name -v`
Expected: FAIL with "function not defined"

- [ ] **Step 3: Write minimal implementation**

```python
def function(input):
    return expected
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/path/test.py::test_name -v`
Expected: PASS

- [ ] **Step 5: Run any broader checks needed**

Run: `[broader command]`
Expected: `[expected result]`
````

The final task in every plan is always the Close Out task (see template above).
Its gates are always manual — it verifies, reviews, and integrates.

## No Placeholders

Every step must contain the actual content an engineer needs. These are **plan failures** — never write them:

- "TBD", "TODO", "implement later", "fill in details"
- "Add appropriate error handling" / "add validation" / "handle edge cases"
- "Write tests for the above" (without actual test code)
- "Similar to Task N" (repeat the code — the engineer may be reading tasks out of order)
- Steps that describe what to do without showing how (code blocks required for code steps)
- References to types, functions, or methods not defined in any task

## Remember

- Exact file paths always
- Complete code in every step — if a step changes code, show the code
- Exact commands with expected output
- DRY, YAGNI, follow the chosen testing strategy

## Task Structure When Testing Is Manual Only

The final task in every plan is always the Close Out task (see template above).
Its gates are always manual — it verifies, reviews, and integrates.

````markdown
### Task N: [Component Name]

**Files:**

- Create: `exact/path/to/file.sh`
- Modify: `exact/path/to/existing.sh:10-40`

- [ ] **Step 1: Implement the requested change**

```bash
[exact command or code change to make]
```

- [ ] **Step 2: Run the targeted verification workflow**

Run: `[exact command or workflow]`
Expected: `[specific success marker]`

- [ ] **Step 3: Perform the manual verification checks from the plan**

- [ ] `[specific check]`
- [ ] `[specific check]`

- [ ] **Step 4: Confirm the listed tests to avoid were not added**

Expected: no automated tests beyond those explicitly called for by the plan
````

For `Manual only` tasks, do not add automated tests unless the plan is updated first.

## Self-Review

After writing the complete plan, look at the spec with fresh eyes and check the plan against it. This is a checklist you run yourself — not a subagent dispatch.

**1. Spec coverage:** Skim each section/requirement in the spec. Can you point to a task that implements it? List any gaps.

**2. Placeholder scan:** Search your plan for red flags — any of the patterns from the "No Placeholders" section above. Fix them.

**3. Type consistency:** Do the types, method signatures, and property names you used in later tasks match what you defined in earlier tasks? A function called `clearLayers()` in Task 3 but `clearFullLayers()` in Task 7 is a bug.

Fix minor consistency and placeholder issues inline. If you change scope or task structure, run the self-review checklist again before handoff. If you find a spec requirement with no task, add the task.

## Execution Handoff

After writing the plan and completing self-review, present the execution configuration using the `present_decisions` tool.

Call `present_decisions` with title "Plan Configuration" and three decisions:

1. **Execution Style** — options: Subagent-Driven (fresh subagent per task), Inline Execution (executing-plans)
2. **Worktree Strategy** — options: Worktree (isolated worktree), Direct (current branch)
3. **Autonomy** — options: Fully autonomous (continuous task-to-task), Checkpointed (pause after each task)

`present_decisions` auto-adds `Something else...` for each decision; do not add duplicates. `otherLabel` renames it, so keep it short.

Read the returned map, record the `Execution Style:`, `Execution Autonomy:`, and `Worktree Strategy:` fields in the plan header, then save the final plan. Before saving the file, if the controller is still in read mode, use the shared write-mode approval prompt first.

After saving, present file artifacts as short markdown links (not bare paths or bare `file://` URLs). Use concise labels, for example:

- `[Open spec](file://...)` when a spec file exists
- `[Open plan](file://...)`

Then present the chosen execution configuration and handoff status.

### Set the session goal

After writing the plan and before handing off for execution, call
`set_session_goal` with the plan title or a complete sentence (but no punctuation or emojis) under 8 words
describing the work (e.g. "Refactor room editor" or "Create current goal
widget"). This records what this plan implements.

Both execution styles must follow the declared autonomy mode and worktree strategy exactly.

**If Subagent-Driven chosen:**
- **REQUIRED SUB-SKILL:** Use know-how:subagent-driven-development
- Fresh subagent per task + dedicated spec, code-quality, and guardian review + close-out task handles integration

**If Inline Execution chosen:**
- **REQUIRED SUB-SKILL:** Use know-how:executing-plans
- Execute inline while performing required spec-compliance, code-quality, and guardian review before each task is complete
- Close-out task handles review, optimization report, and integration
