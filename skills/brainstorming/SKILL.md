---
name: brainstorming
description: "You MUST use this before creative work, feature design, or behavior changes; it turns rough ideas into approved designs before implementation starts."
---

# Brainstorming Ideas Into Designs

Help turn rough ideas into an approved design and a written spec before implementation.

<HARD-GATE>
Do NOT invoke implementation skills, write code, scaffold projects, or make behavior changes until you have presented a design and the user has approved it.
</HARD-GATE>

## Checklist

You MUST create a task for each of these items and complete them in order:

1. **Explore project context** — check files, docs, and recent history
2. **Ask clarifying questions** — one at a time, focused on purpose and constraints
3. **Propose 2-3 approaches** — include trade-offs and a recommendation
4. **Present the design** — scale detail to complexity, get approval section by section
5. **Decide the testing strategy** — identify risky behaviors, manual checks, and whether TDD should be required
6. **Write the design doc** — save to `~/.config/opencode/projects/know-how/<project-name>/specs/YYYY-MM-DD-<topic>-design.md`
7. **Self-review the spec** — remove ambiguity, placeholders, and contradictions
8. **Ask the user to review the spec** — wait for approval before moving on
9. **Transition to implementation planning** — invoke `know-how:writing-plans`

## Process Flow

```dot
digraph brainstorming {
    "Explore project context" [shape=box];
    "Ask clarifying questions" [shape=box];
    "Propose 2-3 approaches" [shape=box];
    "Present design sections" [shape=box];
    "User approves design?" [shape=diamond];
    "Decide testing strategy" [shape=box];
    "Write design doc" [shape=box];
    "Spec self-review" [shape=box];
    "User reviews spec?" [shape=diamond];
    "Invoke writing-plans" [shape=doublecircle];

    "Explore project context" -> "Ask clarifying questions";
    "Ask clarifying questions" -> "Propose 2-3 approaches";
    "Propose 2-3 approaches" -> "Present design sections";
    "Present design sections" -> "User approves design?";
    "User approves design?" -> "Present design sections" [label="no, revise"];
    "User approves design?" -> "Decide testing strategy" [label="yes"];
    "Decide testing strategy" -> "Write design doc";
    "Write design doc" -> "Spec self-review";
    "Spec self-review" -> "User reviews spec?";
    "User reviews spec?" -> "Write design doc" [label="changes requested"];
    "User reviews spec?" -> "Invoke writing-plans" [label="approved"];
}
```

The terminal state is invoking `know-how:writing-plans`.

## The Process

**Understanding the idea:**

- Explore the current project state first
- If the request covers multiple independent subsystems, decompose it before refining details
- Ask one question per message
- Prefer multiple choice when it makes the trade-off clearer
- Focus on purpose, constraints, and success criteria

**Exploring approaches:**

- Always propose 2-3 approaches
- Lead with your recommendation and explain why
- Surface trade-offs honestly

**Presenting the design:**

- Cover architecture, components, data flow, error handling, and testing
- Keep sections short when the problem is simple
- Ask for approval as you go

**Deciding the testing strategy:**

- Decide whether TDD should be required, optional, or skipped
- Identify the highest-risk behavior worth automated coverage
- Call out visual or cosmetic changes that should be verified manually instead
- Avoid designs that imply every UI detail needs an automated assertion

**Working in existing codebases:**

- Follow the existing structure unless it directly blocks the work
- Include targeted cleanup only when it serves the design
- Avoid unrelated refactors

## After the Design

**Documentation:**

- Write the validated spec to `~/.config/opencode/projects/know-how/<project-name>/specs/YYYY-MM-DD-<topic>-design.md`
- Derive `<project-name>` from the current workspace basename and sanitize it for filesystem safety
- If `~/.config/opencode/projects/know-how/<project-name>/` does not exist, create it.
- User preferences for spec location override this default
- Include a short testing strategy section so planning starts from an explicit decision

**Spec Self-Review:**

1. Placeholder scan: remove `TBD`, `TODO`, and vague requirements
2. Internal consistency: ensure sections do not contradict each other
3. Scope check: confirm it is focused enough for one implementation plan
4. Ambiguity check: make edge-case behavior explicit where needed

Fix issues inline and move on.

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
