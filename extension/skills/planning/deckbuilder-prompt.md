# Deckbuilder Subagent Prompt Template

Use this template only when the user has chosen the full HTML spec option and
you are dispatching the **deckbuilder** agent to render a design spec as an
HTML dashboard.

## Quick Reference

```md
Agent:       deckbuilder
Dispatch:    subagent({agent: "deckbuilder", task: "..."})
No reads:    deckbuilder doesn't use the reads parameter
Output:      file://<link>  (returned by deckbuilder as its response)
```

When showing the deckbuilder result to the human, do not paste the bare
`file://` URL. Wrap it in a short markdown link label such as
`[Open spec](file://...)` so it stays clickable in narrow terminals.

When dispatching, the `task` text must contain exactly two things:

1. **`OUTPUT PATH:`** followed by the target file path
2. **A JSON payload** — between the first `{` and last `}`

‼️ Don't read the full agent description, it contains a lot of specifics that will clutter your context ‼️

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

| Type                | Purpose                                                     |
| :---                | :---                                                        |
| `title`             | Document header with text, optional subtitle and date       |
| `prose`             | Markdown content block — the workhorse                      |
| `code-block`        | Syntax-highlighted code via highlight.js, optional caption  |
| `callout`           | Colored left-border aside (info / warning / critical)       |
| `decision-log`      | Individual decision cards with rationale and alternatives     |
| `comparison-table`  | Individual comparison row cards with optional field highlighting |
| `diagram`           | Mermaid diagram (flowchart, sequence, class, state)         |
| `testing-strategy`  | Optional testing approach badge + critical behaviors + manual checks |

## Optional `layout` field

Sections may include an optional `layout` field to control placement in the
masonry flow:

- `"auto"` or omitted: use the section type's default placement (`title` defaults to `full`, `diagram` defaults to `wide`, all other section types default to `normal`)
- `"normal"`: standard card that joins the shared masonry band
- `"wide"`: wider block for content like diagrams that needs more room
- `"full"`: full-page-width block

Use `layout` only when the content needs a non-default footprint. An explicit `"layout": "wide"` on a diagram is optional and just makes that default obvious in examples.

## Example payload

```json
{
  "title": "Example Spec — Deckbuilder v2",
  "sections": [
    {"type": "title", "text": "Example Feature Design", "subtitle": "A demonstration of all v2 components", "date": "2026-05-14"},
    {"type": "prose", "content": "This spec demonstrates every component type available in deckbuilder v2. Use this as a reference when building your own spec payloads."},
    {"type": "callout", "level": "info", "content": "Deckbuilder v2 uses **faithful Flexoki colors** and loads highlight.js for real syntax highlighting."},
    {"type": "code-block", "language": "typescript", "content": "interface Config {\n  endpoint: string;\n  retries: number;\n}", "caption": "Core configuration interface"},
    {"type": "decision-log", "decisions": [{"decision": "Use Flexoki CSS variables", "rationale": "Consistent color system, no hardcoded hex values in templates", "alternatives": "Tailwind tokens (heavier), raw hex everywhere (brittle)"}]},
    {"type": "comparison-table", "headers": ["Approach", "Pros", "Cons"], "rows": [["Typography-first", "Clean, content breathes", "Depends on writer quality"], ["Component kit", "Guides good writing", "More to maintain"]]},
    {"type": "diagram", "layout": "wide", "content": "graph TD\n  A[Controller] -->|JSON payload| B[Deckbuilder]\n  B -->|HTML file| C[Browser]\n  C -->|Review| D[User]", "caption": "Deckbuilder rendering pipeline"},
    {"type": "testing-strategy", "approach": "manual", "critical_behaviors": ["All 8 components render correctly", "Flexoki colors match canonical palette"], "manual_checks": ["Open HTML in browser", "Verify syntax highlighting", "Check no fluff in page source"], "do_not_test": ["Exact pixel values", "Cross-browser rendering"]}
  ]
}
```
