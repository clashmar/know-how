# Optimization Report Deckbuilder Prompt Template

Use this template only when the user has chosen the full HTML report option and
you are dispatching the **deckbuilder** agent from `closing-out-work` to render
maester findings as a persistent HTML dashboard.

## Quick Reference

```md
Agent:       deckbuilder
Dispatch:    subagent({agent: "deckbuilder", task: "..."})
No reads:    deckbuilder doesn't use the reads parameter
Output:      file://<link>  (returned by deckbuilder as its response)
```

When showing the deckbuilder result to the human, do not paste the bare
`file://` URL. Wrap it in a short markdown link label such as
`[Open optimization report](file://...)` so it stays clickable in narrow
terminals.

When dispatching, the `task` text must contain exactly two things:

1. **`OUTPUT PATH:`** followed by the target file path
2. **A JSON payload** — between the first `{` and last `}`

‼️ Don't read the full agent description, it contains a lot of specifics that will clutter your context ‼️

## Output Path Convention

```md
~/.know-how/<project-name>/reports/YYYY-MM-DD-<topic>-optimization-report.html
```

Derive `<project-name>` from `git rev-parse --show-toplevel` basename,
lowercased, non-alphanumeric runs replaced with hyphens.

Use the feature/change summary for `<topic>`, normalized the same way.
This report is a reusable artifact for review and testing, so keep it on disk.

## Section Type Catalog

The JSON payload has a `title` (string, used for `<title>`) and a `sections`
array. Each entry in `sections` must have a `type` field from this catalog:

| Type                | Purpose in optimization reports                                            |
| :---                | :---                                                                       |
| `title`             | Report header with text, optional subtitle and date                        |
| `prose`             | Short narrative blocks for grouped findings or context                     |
| `callout`           | Summary card for counts, emphasis, and AUTO-SURFACE status                 |
| `comparison-table`  | Individual findings cards; can highlight the proposed-fix field            |
| `testing-strategy`  | Optional manual verification guidance when the report needs it             |
| `code-block`        | Optional raw excerpts only when a literal snippet materially helps review  |

## Layout Guidance

Deckbuilder renders as a left-aligned four-column dashboard. Sections flow
top-to-bottom, then left-to-right, so write payloads that scan well as cards.

Prefer this structure:

1. `title` hero with subtitle and date
2. `callout` summary with total suggestions, memory findings, and AUTO-SURFACE count. Use the `level` intentionally: `critical` for urgent auto-surfaces, `warning` when there are actionable process fixes, `info` only for low-risk summaries.
3. Short `prose` sections for grouped narrative context
4. A four-column `comparison-table` for optimization suggestions with `highlight_column: 3`
5. A four-column `comparison-table` for stale-memory audit findings when present
6. Optional `testing-strategy` only when the report should carry explicit manual verification guidance

Do not add a `decision-log` section for optimization reports. The findings cards already contain the actionable information, and duplicating it as separate decision cards makes related items drift apart in the layout.

Use prose sparingly. The report should feel scan-friendly on first open:
summary first, then dense findings in individually placed cards, and
optional review guidance only when it materially helps the human.

## Content Order

The report should cover, in this order:

1. Cross-session auto-surfaces
2. De-duplicated optimization suggestions
3. Stale-memory audit
4. A short note that approvals still happen in the controller via one-by-one `present_choice` prompts

## Suggested Table Shapes

### Optimization suggestions

Use a `comparison-table` with headers (these render as stacked label/value records, not nested tables):

```json
["Tier", "Gap", "Evidence", "Proposed fix"]
```

Set `highlight_column` to `3` so the proposed-fix column carries the visual emphasis.
Use one row per maester suggestion.

### Stale-memory audit

Use a `comparison-table` with headers (these also render as stacked records):

```json
["Severity", "Entries", "Issue", "Suggested resolution"]
```

Use the same record shape so the report stays visually consistent.
Include this table only when the maester surfaced stale-memory findings.

## Example payload

```json
{
  "title": "Know-How Process Optimization Report",
  "sections": [
    {
      "type": "title",
      "text": "Process Optimization Report",
      "subtitle": "close-out optimization report html vs inline",
      "date": "2026-05-15"
    },
    {
      "type": "callout",
      "level": "warning",
      "content": "**Summary:** 1 optimization suggestion, 1 stale-memory observation, 0 AUTO-SURFACES. This HTML artifact is for review before the controller starts one-by-one approval prompts."
    },
    {
      "type": "prose",
      "content": "## Cross-session auto-surfaces\n\n- None in this session.\n\n## Report context\n\nUse structured sections and finding cards so reviewers can scan the report quickly without reading a wall of prose."
    },
    {
      "type": "comparison-table",
      "headers": ["Tier", "Gap", "Evidence", "Proposed fix"],
      "highlight_column": 3,
      "rows": [
        [
          "3",
          "Close-out suggestions are only visible in terse choice UI",
          "Observed in this session while designing the HTML vs inline report step",
          "Add an optimization report choice before per-suggestion approvals and support deckbuilder HTML output"
        ]
      ]
    },
    {
      "type": "comparison-table",
      "headers": ["Severity", "Entries", "Issue", "Suggested resolution"],
      "highlight_column": 3,
      "rows": [
        [
          "OBSERVATION",
          "[project.know-how.example-old, project.know-how.example-new]",
          "Older memory entry is replaced by the newer convention",
          "Keep the newer fact and forget the older one"
        ]
      ]
    },
    {
      "type": "prose",
      "content": "After reviewing this report, the controller must still present each optimization suggestion one-by-one with `present_choice`."
    }
  ]
}
```