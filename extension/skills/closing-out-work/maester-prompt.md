# Maester Close-Out Prompt Template

<!-- Keep context fields consistent with the "What you do" section of extension/agents/maester.md -->

Use this template when dispatching the maester agent at close-out.
Fill in all `<…>` placeholders from this session's context before dispatching.

If no formal per-task reviewers were dispatched:

- Set **Per-task review outputs** to `no per-task reviews — ad-hoc session`.
- Treat **Tasks completed** and **User corrections and steering received this session** as first-class evidence for optimization findings.
- Explicitly call out that formal review count is zero.

```md
subagent({
  agent: "maester",
  task: `Process optimization and memory stewardship sweep.

**Project:** <canonical project name — git root basename>
**Feature / change:** <one-line description of what was built or changed>
**Plan file:** <path to plan file, or "ad-hoc — no formal plan">

**Tasks completed:**
- <task 1 summary>
- <task 2 summary>

**Per-task review outputs (or "no per-task reviews — ad-hoc session" if no formal reviewers were dispatched):**
<paste full output from any reviewer / guardian subagents dispatched during
this work, or "no per-task reviews — ad-hoc session">

**User corrections and steering received this session:**
<list each correction or redirect the user gave, or "none">
`
})
```
