# Know-How

The current year is 2026.

Process know-how for the pi coding agent. Skills, extensions, agents, and specs
that define how pi agents work, what conventions they enforce, and how the
process improves over time.

## Agents

The know-how extension bundles six agents in `extension/agents/`:

- **scout** — Codebase reconnaissance. Reads files, answers bounded questions, returns text report. Read-only.
- **worker** — Task implementation. Writes code, runs tests, self-reviews. No git writes.
- **reviewer** — Code review. Checks spec compliance and code quality. Read-only.
- **guardian** — Convention enforcement. Checks documented project rules at per-task review. Read-only.
- **maester** — Process optimization. Surfurces improvements, audits memory, detects patterns at close-out.
- **deckbuilder** — Renders structured JSON payloads into left-aligned multi-column HTML/CSS dashboards.

The install script (`scripts/install`) copies these agent definitions from
`extension/agents/` to `~/.pi/agent/agents/`. The dispatch extension
(`extension/subagents/dispatch.ts`) resolves agent prompts by looking in the bundled
directory first, then falling back to `~/.pi/agent/agents/`.

## Skills

When creating a new skill or editing an existing one, use the
`writing-skills` skill. It enforces TDD for process documentation:
no SKILL.md without a failing baseline test first.

## pi / pi-tui APIs

**Never redefine types or interfaces from these packages.** If a type exists
in `@mariozechner/pi-coding-agent` or `@earendil-works/pi-tui`, import it —
don't write a local copy. Before writing any `interface` or `type` in extension
code, check `node_modules/@mariozechner/pi-coding-agent/` and
`node_modules/@earendil-works/pi-tui/` first.

Redefining library types is a correctness bug. If the upstream API changes,
the local copy silently drifts. Importing directly means:

- Workers see real field names — no hallucinated fields
- API changes break at compile time, not runtime
- New fields become visible immediately

## pi-coding-agent Package Status

`@mariozechner/pi-coding-agent` provides our extension types and API.
This package is deprecated upstream but remains our import source until
`@samfp/pi-memory` updates its extension API. When pi-memory migrates,
we will update all imports to the new package.

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

**Path translation — before editing any file, map the installed path to the source path:**

| Installed path | Source path in this repo |
| --- | --- |
| `~/.pi/agent/extensions/know-how/skills/X/SKILL.md` | `extension/skills/X/SKILL.md` |
| `~/.pi/agent/agents/X.md` | `extension/agents/X.md` |

Skill files are often read from the installed path because that is where the session
system loads them from. That is fine. But **writes always go to the source path**.
If you have just read a file from `~/.pi/agent/extensions/know-how/`, translate the
path before calling edit or write.

### Keep docs in sync for config and agent changes

If any configuration or agent-related code was changed (for example: agent prompts or definitions
under `extension/agents/`, dispatch logic such as `extension/subagents/dispatch.ts`, scripts that affect
installation, or settings that affect runtime behaviour), repository documentation must be updated
to reflect those changes (AGENTS.md, README.md, and any affected `SKILL.md` files).

### Code style: No `any` types

Do not use `any` in TypeScript code — no `any` type annotations. The project
uses `strict: true` which already implies `noImplicitAny`. Prefer `unknown` with
explicit narrowing, or a well-typed union. **`as` type assertions are acceptable narrowing**
when the right-hand side is a specific type (not `any`).

### TUI rendering width safety

Never render a TUI line wider than the current window width. Width overflow can
cause fatal runtime errors. Fit or wrap plain text before applying ANSI styling,
and prefer manual width-safe wrapping/truncation over APIs that can break
background color fill.

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

## Decision Gates

When the agent presents the user with options to choose from (execution style,
integration action, design approval, etc.), always route through `present_choice`
or `present_decisions`. Never ask the user to type their selection. These tools
auto-add a `Something else...` option; do not include a duplicate. `otherLabel`
renames that option, so keep it short. This applies to new skills and any
legacy choice points discovered during refactoring.

The `guardian` subagent enforces this convention during reviews. Any skill or
agent instruction that asks the user to type a response to pick from options
is a compliance violation.

### Controller write-mode handoffs

When a controller workflow reaches a write-capable step while in read mode, it
uses the shared write-mode approval prompt built on `present_choice` — not a
typed `/write` switch instruction.

## Testing

- If TDD is being used; ALWAYS write failing tests first.
- Use the unitOfWorkConditionExpectedOutcome convention for naming tests.
- If a test references a value or type in the main repo, ALWAYS derive it from the source.
- No magic strings or numbers if they appear in more than one place.

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

## Markdown

- Follow correct md formatting
- Ensure table columns are aligned and not just technically correct

## Red Flags

- **Historical baggage in changes.** Don't reference how things used to work.
  "This skill does NOT load from `old-path`" is noise nobody asked for.
  What matters is what it does now.

- **System process rules in repo AGENTS.md.** Global workflow conventions
  (parallel exploration, git write rules, etc.) belong in
  `~/.pi/agent/AGENTS.md`. The repo's AGENTS.md is for repo-level conventions.

- **Editing installed copies instead of source.**
