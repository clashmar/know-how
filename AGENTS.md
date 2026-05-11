# Know-How

The current year is 2026.

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

## Commit Messages

Use the conventional commit format:

```md
type(scope): short description
```

- **type**: `feat`, `fix`, `refactor`, `docs`, `chore`, `test`
- **scope**: the affected area, e.g. `skills`, `dispatch`, `agents`, `install`
- Description is lowercase, no trailing period, under 72 characters total

Examples:

```md
feat(skills): add verification-before-completion skill
fix(dispatch): resolve agent lookup falling back incorrectly
refactor(agents): rename guardian to sentinel
docs(agents): document maester close-out responsibilities
chore(install): update copy targets for new skills directory
```

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

- **Editing installed copies instead of source.**

## One Source of Truth

If a value, string, or behavior is defined in one place and consumed in another, the consuming code MUST derive from the source of truth instead of hardcoding the value. This is **especially important in tests**, where hardcoded "magic strings" or values are a correctness bug.

GOOD:

```ts
  if (panel.type === PANEL_TYPE_FILE_TREE) {
    // ...
  }
```

BAD:

```ts
  if (panel.type === "file-tree") {
    // ...
  }
```

This extends beyond individual strings to whole systems: shared construction APIs, centralized lookup structures, interface-based infrastructure, and factory registration each eliminates scattered reimplementations of the same logic:

GOOD:

```ts
  const tab = workspace.createTab()
    .withTitle("Output")
    .withPanel(new OutputPanel(logStream))
    .withKeybinding("ctrl-l", "clear-output")
    .build();

  const active = workspace.activePane();
```

BAD:

```ts
  const tab = new Tab();
  tab.title = "Output";
  tab.panels.push(new OutputPanel(logStream));
  workspace.tabs.push(tab);
  workspace.keybindings.set("ctrl-l", "clear-output");

  for (const pane of workspace.panes) {
    if (pane.hasFocus) { ... }
  }
```

Before adding a new type, interface, or subsystem, search for an existing equivalent and reuse it where possible; repeated behavior is a signal to extract a shared abstraction. Before marking a feature complete, review whether any logic introduced during implementation is already handled elsewhere or could be shared with an existing subsystem.

## Comments

Always write `/** ... */` JSDoc comments for public APIs but do not explain implementation details: doc comments say WHAT not HOW:

GOOD: /** Finds a panel by its ID. */
BAD: /**O(n): iterates through the panel list and compares each ID to find a match.*/

Keep other comments to a MINIMUM (one line max) but prefer self-documenting code with readable/meaningful names.
If a comment is being used to protect future regressions, consider using `console.assert()` or a custom type:

```ts
console.assert(
  !this.hasLifecycleHooks<T>(),
  `replaceComponent bypasses lifecycle hooks for ${typeName}. Use insertComponent or removeComponent instead.`
);
```

Don't leave historical baggage from old implementations/iterations that make any kind of reference to how things used to work:
"This function does NOT load from 'old-path'" or "Added a new case to handle the new XYZ value" is noise nobody asked for.
What matters is what it does now; git history is there if we want to know how it got that way.
