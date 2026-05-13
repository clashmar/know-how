# Deckbuilder Subagent Prompt Template

Use this template when dispatching the **deckbuilder** agent to render a design
spec as an HTML dashboard.

## Quick Reference

```md
Agent:       deckbuilder
Dispatch:    subagent({agent: "deckbuilder", task: "..."})
No reads:    deckbuilder doesn't use the reads parameter
Output:      file://<link>  (returned by deckbuilder as its response)
```

When dispatching, the `task` text must contain exactly two things:

1. **`OUTPUT PATH:`** followed by the target file path
2. **A JSON payload** — between the first `{` and last `}`

‼️ Don't read the full agent description, it contains a lot of specifics that will clutter your contex ‼️

## Output Path Convention

```md
~/.know-how/<project-name>/specs/YYYY-MM-DD-<topic>.html
```

Derive `<project-name>` from `git rev-parse --show-toplevel` basename,
lowercased, non-alphanumeric runs replaced with hyphens.

Create the directory with `mkdir -p` if it doesn't exist. User preferences
override the default path — use the user's specified location if provided.

## Section Type Catalog

The JSON payload has a `title` (string, used for `<title>`) and a `sections`
array. Each entry in `sections` must have a `type` field from this catalog:

| Type              | Purpose                                                   |
| :---              | :---                                                      |
| `hero`            | Title header with optional subtitle, timestamp, badges    |
| `summary`         | Block of free-form markdown text                          |
| `priority-table`  | Tiered table with row coloring by priority column         |
| `findings-list`   | List of items with severity icons (critical/warning/info) |
| `code-block`      | Syntax-highlighted code snippet                           |
| `callout`         | Highlighted aside with colored left border                |
| `two-column`      | Two side-by-side panels, each containing a nested section |
| `metrics`         | Dashboard of key-value metric cards with trend arrows     |

## Example payload

```json
{
  "title": "Feature Design — Example",
  "sections": [
    {"type": "hero", "title": "Feature Design", "subtitle": "Example Feature", "timestamp": "2026-05-13", "badges": ["v1", "draft"]},
    {"type": "summary", "content": "Brief overview of what this feature builds and why."},
    {"type": "priority-table", "headers": ["Tier", "Task", "Owner"], "rows": [["1", "Core API", "alice"], ["2", "UI polish", "bob"], ["3", "Docs update", "carol"]], "tierColumn": 0},
    {"type": "findings-list", "items": [{"text": "**Critical:** auth token expires prematurely", "severity": "critical"}, {"text": "Button color inconsistent on *dark mode*", "severity": "warning"}, {"text": "Typo in onboarding copy", "severity": "info"}]},
    {"type": "code-block", "language": "typescript", "content": "interface Config {\n  endpoint: string;\n  retries: number;\n}"},
    {"type": "callout", "level": "warning", "content": "This feature requires the **v2 auth service** to be deployed first."},
    {"type": "two-column", "left": {"type": "summary", "content": "**Current:** manual process takes 20 minutes per deploy."}, "right": {"type": "summary", "content": "**Proposed:** automated pipeline, under 2 minutes."}},
    {"type": "metrics", "metrics": [{"label": "Tasks", "value": "8"}, {"label": "Est. days", "value": "5", "trend": "up"}, {"label": "Risk level", "value": "Medium"}, {"label": "Reviewers", "value": "2", "trend": "stable"}]}
  ]
}
```
