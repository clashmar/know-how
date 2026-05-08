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
