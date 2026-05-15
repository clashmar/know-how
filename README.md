# know-how

pi skill bundle and extension.

## Install

```bash
./scripts/install
```

Running `./scripts/install` again is the supported update path.

## Uninstall

Remove the bundled plugin and skills with:

```bash
./scripts/uninstall
```

## Installed layout

The install script manages only this runtime layout:

```text
~/.pi/agent/extensions/know-how.ts
~/.pi/agent/skills/know-how/
```

It does not modify unrelated files already present in `~/.pi/agent`.

## Example settings

```json
{
  "knowHow": {
    "subagents": {
      "scout": {
        "model": "demo-model-scout",
        "fallbackModels": [
          "demo-model-fallback"
        ],
        "thinkingLevel": "low"
      },
      "worker": {
        "model": "demo-model-worker",
        "fallbackModels": [
          "demo-model-fallback"
        ],
        "thinkingLevel": "high"
      },
      "reviewer": {
        "model": "demo-model-reviewer",
        "fallbackModels": [
          "demo-model-fallback"
        ],
        "thinkingLevel": "high"
      },
      "guardian": {
        "model": "demo-model-guardian",
        "fallbackModels": [
          "demo-model-fallback"
        ],
        "thinkingLevel": "medium"
      },
      "maester": {
        "model": "demo-model-maester",
        "fallbackModels": [
          "demo-model-fallback"
        ],
        "thinkingLevel": "high"
      },
      "deckbuilder": {
        "model": "demo-model-deckbuilder",
        "fallbackModels": ["demo-model-fallback"],
        "thinkingLevel": "low"
      }
    }
  }
}
```

If any values aren't set for a specifc agent, they will fall
back to the session default.

The `deckbuilder` agent renders left-aligned four-column HTML dashboards.
Payloads may use any supported section types; `testing-strategy` is optional
and is typically used for specs rather than every report.
