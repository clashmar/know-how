---
name: session-reflection
description: |
  Use when starting or ending meaningful work — captures decisions, user
  corrections, and recurring problems into project reflections so future
  sessions reconstruct context and learn from past mistakes. Also use when
  resuming work on a project to catch up on recent decisions and patterns.
---

# Session Reflection & Context Reconstruction

## Overview

Capture what was learned, decided, and corrected during meaningful work so future
sessions can reconstruct context and learn from past mistakes. Use `/reflect` to
write a structured reflection and `/catch-up` to rebuild project context.

**Core principle:** Every user correction, every hard decision, every pattern
that repeats is worth capturing. Future you (and future agents) will start
smarter because of it.

## Checklist

<IMPORTANT>
When this skill is loaded (via /reflect, closing-out-work, or manually), follow
the appropriate section below based on what you're doing.
</IMPORTANT>

## When to Reflect

Run `/reflect` or ask the user if they want you to reflect when:

1. **After any session where files were modified** — code, config, skills, or
   documentation. File modification is the primary indicator of meaningful work.
   Don't wait for "feature or milestone" scale to reflect.
2. **After any user correction or steering** — the user redirected you, told you
   to do something differently, or caught a mistake. This feedback MUST be
   captured, even in otherwise read-only sessions.
3. **When you notice a pattern repeating** — you made the same kind of mistake
   again, or the user corrected the same kind of thing twice
4. **After completing a significant feature or milestone** — even if trigger #1
   already applies, a milestone warrants a more thorough reflection
5. **When closing-out-work tells you to** — the close-out skill includes a
   mandatory reflection step

Do NOT reflect for trivial sessions: no file changes, no decisions made, no
corrections received (e.g., a quick Q&A or read-only exploration).

## How to Reflect

You can either call `/reflect [topic]` or write the reflection file manually.

### Using /reflect

```
/reflect auth-refactor
```

This loads this skill into context. Then:

### Steps

1. **Scan prior reflections** — read files in `~/.know-how/<project>/reflections/`
   to check for recurring patterns and stale decisions.

2. **Query pi-memory** — run memory_search for project-scoped facts to see what's
   already stored.

3. **Write the reflection file** to
   `~/.know-how/<project-name>/reflections/YYYY-MM-DD-<topic>.md` using the write
   tool.

4. **Persist to pi-memory** — for each key decision, correction, or lesson:
   - Call memory_search to find existing facts
   - Call memory_forget on any facts that are now obsolete
   - Call memory_remember for new/updated decisions, project facts, and lessons

### Reflection format

Every reflection MUST include these sections. Fill each one honestly.

```markdown
# Reflection: <topic>

**Session:** <date or context — e.g., "2026-05-07 afternoon">
**Scope:** <one sentence describing what this work covered>

## What was accomplished

- <concrete achievements, be specific>

## Decisions made

- **<decision>** — <rationale>. <who approved or suggested it>.

## User corrections & steering

- Originally <what you did>. User redirected: "<what user said>".
  <what changed as a result>.

## Mistakes & fixes

- <what went wrong>, caught by <user/review/tests>, fixed by <solution>.

## Recurring problems to watch

- **<Nth time>** <pattern>. Previous: <reference to past reflection or session>.
  Pattern: <why this keeps happening>.

## Remaining work

- <outstanding tasks, known follow-ups, decisions still pending>

## pi-memory entries

- `<key>` → stored via memory_remember
- `<lesson>` → stored via memory_remember
- `<key>` → removed via memory_forget (superseded by new decision)
```

### Staleness cleanup

When reflecting, you MUST check for and remove stale pi-memory facts:

1. Call memory_search scoped to the project
2. Compare: does any new decision make an existing fact obsolete?
3. Call memory_forget on stale entries
4. Only drop facts you're confident are obsolete — don't delete just because
   they're old. If unsure, keep the fact and note the conflict for human review.
5. The reflection file is the audit trail — even if a fact is removed from
   pi-memory, the narrative history remains.

### What to persist to pi-memory

Push only entries future sessions genuinely need. Don't spam.

| When                              | Key                                  | Type                                       |
| --------------------------------- | ------------------------------------ | ------------------------------------------ |
| Architecture/design decision made | `<project>.decision.<topic>`         | fact                                       |
| Project convention established    | `<project>.project.<convention>`     | fact                                       |
| User correction that should stick | `<project>.lesson.<correction-name>` | lesson (use memory_remember type="lesson") |

### Pi-Memory Naming Convention

All pi-memory facts MUST use the following key format:

```
{project}.{domain}.{fact}
```

**Domains:**

| Domain       | Purpose                                            | Example                              |
|--------------|----------------------------------------------------|--------------------------------------|
| `project`    | Conventions, structure, APIs, and project-level facts | `bishop.project.commit-format`    |
| `decision`    | Settled architectural choices with reasoning       | `bishop.decision.room-grid-api`     |
| `lesson`     | Learned corrections (use `type: "lesson"`)          | `know-how.lesson.ad-hoc-memory-keys`|

**Canonical project name:**

The project name is derived from the **git root directory name**, NOT the CWD or worktree name. This ensures all agents working on the same project — regardless of worktree — store and retrieve facts under the same key. The normalization logic is:

- lowercased
- non-alphanumeric runs replaced with `-`
- leading/trailing `-` stripped

Examples:
- Worktree `~/Personal/bishop-feature-x` → canonical project is `bishop`
- Direct checkout `~/Personal/bishop` → canonical project is `bishop`

**Global / cross-project decisions:** Decisions that apply to all projects (e.g., "no `any` types in TypeScript") live under the `know-how` project — since know-how is the process layer that governs all projects.

**Enforcement:** The guardian checks memory keys during per-task review. The maester audits for key-pattern violations during close-out stale-memory sweeps. If a fact uses an unexpected namespace or format, flag it as a naming violation.

## How to Catch Up

### On session start

When you start a new session on a project with prior reflections, the
`<project-state>` block is automatically injected into your context. Read it
first — it tells you where the project stands, recent decisions, and recurring
patterns to watch.

### When the automatic catch-up is insufficient

Call `/catch-up` to get a fresh synthesis. Or read specific reflection files
directly from `~/.know-how/<project>/reflections/` using the read tool.

### Supplement with pi-memory

Run memory_search for the project name to find additional stored facts and
preferences. Run memory_search with a lesson-related query (e.g.
`"lessons"` or `"corrections"`) to check for corrections from past sessions.

## Integration Points

### closing-out-work

The closing-out-work skill now includes a reflection step (Step 5). When you
reach that step, produce a reflection covering everything from this work unit:
decisions made, corrections received, recurring patterns, remaining work.

### brainstorming

Decisions made during brainstorming (architecture choices, approved directions)
should become reflection entries after the work is implemented — not during
brainstorming itself.

### systematic-debugging

When a bug has a root cause that reveals a pattern (e.g., "this is the third
time we've had a race condition in the event loop"), capture it as a lesson.

### requesting-code-review

When reviewer feedback reveals a pattern you've been corrected on before, flag
it in the "Recurring problems to watch" section.

## Key Principles

- Honesty over face-saving — admitting mistakes in reflections is how you stop
  repeating them
- User corrections are gold — they teach you what the user actually wants
- Patterns matter more than one-offs — a mistake that happens twice is a signal
- Don't reflect for trivial work — small tasks don't need the overhead
- Stale facts are worse than no facts — clean up pi-memory when decisions change
