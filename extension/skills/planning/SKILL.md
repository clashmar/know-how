---
name: planning
description: Use when the user explicitly asks to plan, runs /plan, or wants a written design or spec before implementation.
disable-model-invocation: true
---

# Planning Ideas Into Designs

Use this for explicit planning requests that need an approved design and a written spec before implementation.

Do not invoke implementation skills, write code, scaffold projects, or make behavior changes until you have presented a design and the user has approved it.

## Checklist

<IMPORTANT>
Create a task for each of these items and complete them in order:

1. **Explore project context** — dispatch parallel `scout` agents with bounded tasks (see `../dispatching-parallel-agents/scout-prompt.md`). Each scout gets: specific files to read, 1-3 tightly scoped questions to answer, a stop boundary, and a conciseness directive. Prefer 1-3 files per scout unless the task explicitly requires more. Prefer follow-up scouts over synthesis-heavy first-pass prompts. Gather all results before continuing. Never dispatch a scout with a vague mandate like "explore the codebase."
2. **Ask clarifying questions** — one at a time, focused on purpose and constraints
3. **Propose 2-3 approaches** — include trade-offs and a recommendation
4. **Present the design** — scale detail to complexity, get approval section by section
5. **Decide the testing strategy** — identify critical behaviors, manual checks, whether the work should use TDD or be manually tested, and exclude dedicated automated tests for temporary or mock-only behavior unless that seam has lasting business value
6. **Write the design doc** — write the spec per the Documentation section below.
7. **Self-review the spec** — remove ambiguity, placeholders, and contradictions
8. **Ask the user to review the spec** — wait for approval before moving on
9. **Set the session goal** — call `set_session_goal` with the spec title as a complete sentence (but no punctuation or emojis) under 8 words.
10. **Transition to implementation planning** — if the controller is still in read mode,
   run `/write` to open the write-mode approval prompt before continuing
   (the plan will be written to disk). Then invoke `know-how:writing-plans`.
</IMPORTANT>

## The Process

**If the user has not specified what they want to plan yet** 
- Just ask them "What would you like to plan?" and wait for their response. 
- Don't make any tool calls
- Don't make a todo list yet
- Just ask and wait for their answer. Then continue with the checklist above.

**Understanding the idea:**

- **Explore the current project state first using parallel `scout` agents.** Dispatch them per checklist step 1 and gather all results before drawing conclusions.
- **Always include one scout that covers file structure.** Start with 1-2 tightly scoped questions about naming conventions and ownership. If placement is still unclear, use a follow-up scout to find the closest existing equivalents.
- If the request covers multiple independent subsystems, decompose it before refining details
- Ask one question at a time and use `present_choice` for all questions and approval gates
- Focus on purpose, constraints, and success criteria

⚠️ HARD GATE: MAX 3 concurrent subagents ⚠️

**Exploring approaches:**

- Always propose 2-3 approaches
- Lead with your recommendation and explain why
- Surface trade-offs honestly

**Presenting the design:**

- Cover architecture, components, data flow, error handling, and testing
- Keep sections short when the problem is simple
- Ask for approval as you go

**Deciding the testing strategy:**

- Decide whether TDD should be required or manual only
- Identify the highest-risk behaviors worth automated coverage
- Treat temporary scaffolding, mocked payloads, app-local fallback seams, and other short-lived bridge behavior as manual-verification territory unless that seam has lasting business value or meaningful regression risk
- Call out visual or cosmetic changes that should be verified manually instead
- Avoid designs that imply every UI detail needs an automated assertion
- Avoid test plans whose only purpose is to lock in temporary or mock-only behavior

**Working in existing codebases:**

- Follow the existing structure unless it directly blocks the work
- Include targeted cleanup only when it serves the design
- Avoid unrelated refactors

## After the Design

**Documentation:**

- Write the validated spec to `~/.know-how/<project-name>/specs/YYYY-MM-DD-<topic>.md` and present the path to the user.
- Derive `<project-name>` from the git repository root (`git rev-parse --show-toplevel`)
  basename, lowercased with non-alphanumeric runs replaced by hyphens.
- If `~/.know-how/<project-name>/` does not exist, use `present_choice` to
  offer: create it, use another path, or skip (write the spec inline to the
  current context).
- User preferences for spec location override this default.
- Include a short testing strategy section so planning starts from an explicit
  decision.

**Spec Self-Review:**

1. Placeholder scan: remove `TBD`, `TODO`, and vague requirements
2. Internal consistency: ensure sections do not contradict each other
3. Scope check: confirm the scope can be executed as one coherent plan without mixing unrelated subsystems or independent deliverables
4. Ambiguity check: make edge-case behavior explicit for any case that changes user-visible behavior, validation, failure handling, or state transitions

Fix self-review issues inline. If a fix changes the design materially, present the updated spec to the user before planning.

**User Review Gate:**

After the self-review passes, ask the user to review the written spec before planning.

> "Spec written to `<path>`. Please review it and let me know if you want any changes before we write the implementation plan."

Wait for approval before invoking the next skill.

## Key Principles

- One question at a time
- Multiple choice preferred when useful
- YAGNI aggressively
- Explore alternatives before settling
- Get explicit approval before implementation
