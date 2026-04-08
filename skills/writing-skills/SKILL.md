---
name: writing-skills
description: Use when creating new skills, editing existing skills, or verifying skills work before deployment
---

# Writing Skills

## Overview

Writing skills is Test-Driven Development applied to process documentation.

Skills live in OpenCode skill directories:

- `~/.config/opencode/skills/` for personal skills
- `.opencode/skills/` for project skills
- bundled plugin `skills/` directories for distributed skill packs

You run realistic scenarios, watch agents fail without the skill, write the skill, verify it works, and refactor to close loopholes.

**Core principle:** If you did not watch an agent fail without the skill, you do not know whether the skill teaches the right thing.

**REQUIRED BACKGROUND:** You MUST understand `know-how:test-driven-development` before using this skill.

## What a Skill Is

A skill is a reusable reference guide for a technique, pattern, workflow, or tool.

**Skills are:** reusable techniques, patterns, tools, and references.

**Skills are not:** narratives about solving one specific problem once.

## TDD Mapping

| TDD Concept | Skill Creation |
|-------------|----------------|
| Test case | Pressure scenario with a subagent |
| Production code | `SKILL.md` |
| RED | Agent violates rule without skill |
| GREEN | Agent complies with skill present |
| REFACTOR | Close loopholes and re-test |

The whole process is RED-GREEN-REFACTOR.

## When to Create a Skill

Create one when:

- the technique was not obvious
- you expect to reuse it across projects
- it captures judgment, not just syntax
- other agents or teammates would benefit

Do not create one for:

- one-off solutions
- standard practice already covered elsewhere
- project-specific conventions better stored in `AGENTS.md`
- purely mechanical rules that should be automated

## Skill Types

**Technique:** concrete steps to follow.

**Pattern:** a way of reasoning about a class of problems.

**Reference:** API, syntax, or heavy supporting material.

## Directory Structure

```text
skills/
  skill-name/
    SKILL.md
    supporting-file.*
```

Add supporting files only for heavy reference material or reusable scripts/templates.

## SKILL.md Structure

Frontmatter rules:

- required: `name`, `description`
- `name`: letters, numbers, hyphens only
- `description`: describe **when to use** the skill, not the process inside it
- start with `Use when...`

Suggested shape:

```markdown
---
name: skill-name
description: Use when [specific triggers or symptoms]
---

# Skill Name

## Overview
Core idea in 1-2 sentences.

## When to Use
Concrete triggers and situations.

## Core Pattern
Show the key workflow or decision pattern.

## Quick Reference
Short table or bullets for scanning.

## Common Mistakes
What goes wrong and how to recover.
```

## Skill Discovery Optimization

Descriptions should help OpenCode decide whether to load the skill.

**Description = when to use, not what it does.**

```yaml
# Bad: workflow summary
description: Use when executing plans by dispatching subagents and reviewing each task

# Good: triggering conditions only
description: Use when executing implementation plans with mostly independent tasks in the current session
```

Good descriptions:

- use concrete triggers and symptoms
- describe the problem being recognized
- avoid workflow summaries that let the model skip the full skill

## Cross-Referencing Other Skills

When a skill depends on another skill, use the skill name with an explicit marker:

- `**REQUIRED SUB-SKILL:** Use know-how:test-driven-development`
- `**REQUIRED BACKGROUND:** You MUST understand know-how:systematic-debugging`

Do not point at raw file paths when the expectation is to load another skill.

## Flowcharts

Use flowcharts only for:

- non-obvious decisions
- process loops where the model might stop too early
- "use A vs B" choices

Do not use them for reference material or linear instructions.

Use `render-graphs.js` in this directory to render a skill's flowcharts when needed.

## Code Examples

Prefer one strong example over many weak ones.

Good examples are:

- complete enough to adapt
- focused on the key pattern
- written in the most relevant language
- commented only where the reasoning is non-obvious

## The Iron Law

```text
NO SKILL WITHOUT A FAILING TEST FIRST
```

This applies to new skills and edits to existing skills.

If you wrote or edited a skill before running a baseline test, delete the unverified change and start over.

**REQUIRED BACKGROUND:** The `know-how:test-driven-development` skill explains why the order matters.

## Testing Skill Work

Use `testing-skills-with-subagents.md` when you need the detailed test workflow.

At minimum, verify:

1. RED: run realistic scenarios without the skill and capture failures verbatim
2. GREEN: write the smallest skill that addresses those failures
3. REFACTOR: pressure-test, capture new rationalizations, and close each loophole

## File Organization

Use a self-contained skill when the material fits comfortably in one file.

Add supporting files when:

- the reference is too large for `SKILL.md`
- a reusable script or template is part of the technique

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Writing the skill before baseline testing | Run RED first |
| Weak scenarios with no pressure | Combine 3+ realistic pressures |
| Generic advice instead of targeted counters | Address exact rationalizations verbatim |
| Stopping after one passing run | Pressure-test again until no new loopholes appear |

## Bottom Line

Skill creation is TDD for process documentation.

If you would not trust untested code, do not trust untested skill docs.
