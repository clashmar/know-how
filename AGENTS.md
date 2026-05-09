# Know-How

Process know-how for the pi coding agent. Skills, extensions, agents, and specs
that define how pi agents work, what conventions they enforce, and how the
process improves over time.

## Agents

- **guardian** — Convention enforcement during per-task review. Checks documented
  project rules (AGENTS.md, project skills, pi-memory) are followed.
- **maester** — Process optimization and memory stewardship at close-out.
  Synthesizes optimization suggestions, audits pi-memory for contradictions,
  detects cross-session patterns, appends to the optimization log.

## Contribution Guidelines

## Red Flags

- **Historical baggage in changes.** Don't reference how things used to work.
  "This skill does NOT load from <old-path>" is noise nobody asked for.
  What matters is what it does now.
- **System process rules in repo AGENTS.md.** Global workflow conventions
  (parallel exploration, git write rules, etc.) belong in
  `~/.pi/agent/AGENTS.md`. The repo's AGENTS.md is for repo-level conventions.
