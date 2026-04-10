---
name: executing-plans
description: Use when you have a written implementation plan to execute directly with review checkpoints
---

# Executing Plans

## Overview

Load plan, review critically, read the declared `Execution Autonomy`, execute tasks with required verification and review, report when complete.

**Announce at start:** "I'm using the executing-plans skill to implement this plan."

**Use this skill when:** the inline execution path has been chosen for the plan.

## The Process

### Step 1: Load and Review Plan
1. Read plan file
2. Read the plan's declared `Execution Autonomy`
3. Review critically - identify any questions or concerns about the plan
4. If concerns: Raise them with your human partner before starting
5. If no concerns: Create TodoWrite and proceed

### Step 2: Execute Tasks

Before executing tasks, read `Execution Autonomy` from the plan.

- `Fully autonomous`: continue task-to-task unless a stop condition interrupts execution.
- `Checkpointed`: after each completed task, report status and wait for user approval before continuing.

In both autonomy modes, a task is complete only after its required verification, spec-compliance review, and code-quality review succeed.

The spec-compliance review and code-quality review are separate mandatory gates for every task in inline execution.

If either review leads to code changes, re-run the task's required verification on the updated code, then re-run spec-compliance review and code-quality review before marking the task complete.

For each task:
1. Mark as in_progress
2. Follow each step exactly (plan has bite-sized steps)
3. Run verifications as specified
4. Re-read the current task and confirm the implementation matches the task and plan without adding unrequested behavior. This is the mandatory spec-compliance review gate.
5. Run a distinct code-quality review of the changed work before proceeding. This review is mandatory for every task. For risky, behavior-changing, or multi-file tasks, use know-how:requesting-code-review for a focused review.
6. If either review changes code, re-run the task's required verification and both review gates on the updated state
7. Mark as completed
8. If `Execution Autonomy` is `Checkpointed`, report status and wait for user approval before starting the next task

### Step 3: Complete Development

After all tasks complete and verified:
- Run one final whole-implementation code-quality review before closing out the work
- If that final review requires code changes, re-run the relevant verification and review on the updated code before continuing
- Announce: "I'm using the closing-out-work skill to complete this work."
- **REQUIRED SUB-SKILL:** Use know-how:closing-out-work
- Follow that skill to close out the work, ask for review, and then choose integration

## When to Stop and Ask for Help

**STOP executing immediately when:**
- Hit a blocker (missing dependency, test fails, instruction unclear)
- Plan has critical gaps preventing starting
- You don't understand an instruction
- Verification fails repeatedly
- Required context is missing
- The user interrupts or redirects the work

**Ask for clarification rather than guessing.**

## When to Revisit Earlier Steps

**Return to Review (Step 1) when:**
- Partner updates the plan based on your feedback
- Fundamental approach needs rethinking

**Don't force through blockers** - stop and ask.

## Remember
- Review plan critically first
- Read and follow the plan's `Execution Autonomy` exactly
- Follow plan steps exactly
- Follow the plan's `Testing Approach` exactly
- Don't skip verifications
- Don't mark a task complete before spec-compliance review and code-quality review
- If review changes code, re-run verification and re-review before completion
- Don't skip the final whole-implementation review before `closing-out-work`
- Reference skills when plan says to
- Stop when blocked, don't guess
- Never start implementation on main/master branch without explicit user consent
- Use the current workspace unless the user explicitly asks for a different setup

## Integration

**Required workflow skills:**
- **know-how:writing-plans** - Creates the plan this skill executes
- **know-how:requesting-code-review** - Use for focused code review on risky, behavior-changing, or multi-file tasks
- **know-how:closing-out-work** - Close out work after all tasks, get user review, then choose integration
