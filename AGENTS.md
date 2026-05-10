# Know-How

Process know-how for the pi coding agent. Skills, extensions, agents, and specs
that define how pi agents work, what conventions they enforce, and how the
process improves over time.

## Agents

The know-how extension bundles five agents in `extension/agents/`:

- **scout** — Codebase reconnaissance. Reads files, answers bounded questions, returns text report. Read-only.
- **worker** — Task implementation. Writes code, runs tests, self-reviews. No git writes.
- **reviewer** — Code review. Checks spec compliance and code quality. Read-only.
- **guardian** — Convention enforcement. Checks documented project rules at per-task review. Read-only.
- **maester** — Process optimization. Synthesizes improvements, audits memory, detects patterns at close-out.

The install script (`scripts/install`) copies these agent definitions from
`extension/agents/` to `~/.pi/agent/agents/`. The dispatch extension
(`extension/dispatch.ts`) resolves agent prompts by looking in the bundled
directory first, then falling back to `~/.pi/agent/agents/`.

## Contribution Guidelines

### Edit the source, not the install target

`scripts/install` copies files from this repo to `~/.pi/agent/extensions/know-how/`
and `~/.pi/agent/agents/`. **Always edit files inside this repo**.
Editing files under `~/.pi/agent/` directly means the change is wiped on the next install
and nobody can see it in version control.

### Code style: No `any` types

Do not use `any` in TypeScript code — no `any` type annotations. The project
uses `strict: true` which already implies `noImplicitAny`. Prefer `unknown` with
explicit narrowing, or a well-typed union. **`as` type assertions are acceptable narrowing** when the right-hand side is a specific type (not `any`).

## Red Flags

- **Historical baggage in changes.** Don't reference how things used to work.
  "This skill does NOT load from `old-path`" is noise nobody asked for.
  What matters is what it does now.

- **System process rules in repo AGENTS.md.** Global workflow conventions
  (parallel exploration, git write rules, etc.) belong in
  `~/.pi/agent/AGENTS.md`. The repo's AGENTS.md is for repo-level conventions.
