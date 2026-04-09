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

**Save plans to:** `~/.config/opencode/projects/know-how/<project-name>/plans/YYYY-MM-DD-<feature-name>.md`
- Derive `<project-name>` from the current workspace basename and sanitize it for filesystem safety if creating from scratch
- If `~/.config/opencode/projects/know-how/<project-name>/` does not exist, ask the user before creating it
- If the user declines, ask where they want to save the plan and use that path for the rest of the process. If they decline again, write to the current context.
- User preferences for plan location override this default

## Core Rule

Decide the testing strategy before writing tasks.

The plan must explicitly decide:

- whether TDD is required or manual only
- which behaviors need automated coverage
- which changes should be verified manually
- which low-value tests to avoid

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

## Scope Check

If the spec covers multiple independent subsystems, it should have been broken into sub-project specs during brainstorming. If it wasn't, suggest breaking this into separate plans — one per subsystem. Each plan should produce working, testable software on its own.

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

## Plan Document Header

**Every plan MUST start with this header:**

```markdown
# [Feature Name] Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use know-how:subagent-driven-development (recommended) or know-how:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** [One sentence describing what this builds]

**Architecture:** [2-3 sentences about approach]

**Tech Stack:** [Key technologies/libraries]

## Testing Approach

**TDD Decision:** Required | Manual only

Follow this exactly during implementation.
If the decision is `Manual only`, do not add automated tests.
If the decision is `Required`, write the failing test first and follow TDD strictly.

**Manual verification:**
- [specific checks to perform]

---
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

If you find issues, fix them inline. No need to re-review — just fix and move on. If you find a spec requirement with no task, add the task.

## Execution Handoff

After saving the plan, offer execution choice:

**"Plan complete and saved to `<path>`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?"**

**If Subagent-Driven chosen:**
- **REQUIRED SUB-SKILL:** Use know-how:subagent-driven-development
- Fresh subagent per task + two-stage review

**If Inline Execution chosen:**
- **REQUIRED SUB-SKILL:** Use know-how:executing-plans
- Batch execution with checkpoints for review
