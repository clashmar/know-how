---
name: executing-plans
description: Use when you have a written implementation plan to execute directly with review checkpoints
---

# Executing Plans

## Overview

Load plan, review critically, execute all tasks, report when complete.

**Announce at start:** "I'm using the executing-plans skill to implement this plan."

**Use this skill when:** the inline execution path has been chosen for the plan, or when you need to execute a written implementation plan directly without subagents.

## The Process

### Step 1: Load and Review Plan
1. Read plan file
2. Review critically - identify any questions or concerns about the plan
3. If concerns: Raise them with your human partner before starting
4. If no concerns: Create TodoWrite and proceed

### Step 2: Execute Tasks

For each task:
1. Mark as in_progress
2. Follow each step exactly (plan has bite-sized steps)
3. Run verifications as specified
4. Mark as completed

### Step 3: Complete Development

After all tasks complete and verified:
- Announce: "I'm using the closing-out-work skill to complete this work."
- **REQUIRED SUB-SKILL:** Use know-how:closing-out-work
- Follow that skill to close out the work, ask for review, and then choose integration

## When to Stop and Ask for Help

**STOP executing immediately when:**
- Hit a blocker (missing dependency, test fails, instruction unclear)
- Plan has critical gaps preventing starting
- You don't understand an instruction
- Verification fails repeatedly

**Ask for clarification rather than guessing.**

## When to Revisit Earlier Steps

**Return to Review (Step 1) when:**
- Partner updates the plan based on your feedback
- Fundamental approach needs rethinking

**Don't force through blockers** - stop and ask.

## Remember
- Review plan critically first
- Follow plan steps exactly
- Follow the plan's `Testing Approach` exactly
- Don't skip verifications
- Reference skills when plan says to
- Stop when blocked, don't guess
- Never start implementation on main/master branch without explicit user consent
- Use the current workspace unless the user explicitly asks for a different setup

## Integration

**Required workflow skills:**
- **know-how:writing-plans** - Creates the plan this skill executes
- **know-how:closing-out-work** - Close out work after all tasks, get user review, then choose integration
