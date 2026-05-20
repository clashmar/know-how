# Config

What can be configured (so far):

## Example

```json
{
  "knowHow": {
    "readMode": {
      "toolBlacklist": ["some_custom_tool"]
    },
    "subagents": {
      "scout": {
        "model": "fast-and-cheap-local-model",
        "fallbackModels": [
          "even-faster-and-cheaper"
        ],
        "thinkingLevel": "low"
      },
      "worker": {
        "model": "no-nonsense-workhorse",
        "fallbackModels": [
          "your-other-subscriptions-workhorse"
        ],
        "thinkingLevel": "medium"
      },
      "reviewer": {
        "model": "keep-it-speedy-here",
        "fallbackModels": [
          "keep-it-speedy-here-too"
        ],
        "thinkingLevel": "medium"
      },
      "guardian": {
        "model": "needs-to-read-wider-context",
        "fallbackModels": [
          "mid-level-model-recommended"
        ],
        "thinkingLevel": "medium"
      },
      "maester": {
        "model": "one-of-the-big-hitters",
        "fallbackModels": [
          "one-of-the-others"
        ],
        "thinkingLevel": "high"
      },
      "deckbuilder": {
        "model": "small-boi-for-frontend",
        "fallbackModels": [
          "keep-it-fast"
        ],
        "thinkingLevel": "low"
      }
    }
  }
}
```

## Read mode tool blacklist

Tools in the blacklist are unavailable in read mode. The default blacklist (`edit`, `write`) is always applied — the config adds to it, not replaces.

## Defaults

- Unset values fall back to the session default.
- If a model and its fallback fail, the controller will stop for direction.
- Subagent configs with no entry fall back to the session defaults.
- The default read-mode blacklist is `["edit", "write"]` — pi's native write tools. The user `toolBlacklist` extends this list.
