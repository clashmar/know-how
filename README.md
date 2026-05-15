# know-how

Know-how is a WIP pi extension designed to give developers control over their workflows.

## Problems it solves

- Gives you solid tools, UI and common features out-the-box. Read/Write mode and ui components are made to fit the flow.

- Some other extensions, though really cool, don't always play nicely with each other. know-how joins everything up into a **cohesive but flexible system**. Subagents are configurable in a similar way to pi-subagents but are designed to thrive in this system.

- Most existing skill bundles force you into using workflows or strategies you might not like or need for a particular session. Don't need TDD for a minor UI change? Don't like using worktrees? Don't need subagents for a quick change? Don't want to hand over the keys to git? These **decisions are baked into planning phase** as a contract you just have to press enter to sign.

- Keeps you in control at every step, or not, whatever it's your choice. You can checkpoint and review every step of the way, or YOLO the whole thing. know-how **won't do anything you don't want it to** and will help you from becoming the bottleneck.

- Once you've made these decisions, **know-how will enforce them**. The tools and UI are woven into the agents and skills.

- **Standards and Scope** are enforced during reviews as well as the usual spec/quality reviews, meaning you spend less time fixing recurring violations of your personal/project standards or arguing with it about random refactoring/reformatting nobody asked for.

- **know-how reflects on the process**. It surfaces process issues to you, optionally actions them, reflects on them and remembers them. know-how piggy-backs on pi-memory with extra layers to integrate it into the workflow and a dedicated agent to maintain memory and analyze it.

## Agents

All subagents start with fresh context and are designed to balance speed, token use and consistency.
Feature planned to easily disable their use in a session. Useful for request-based services.

- **scout** - fast recon of codebase that returns summaries to controller.

- **worker** - executes implementation and fixes after review.

- **reviewer** - called as parallel spec/quality reviewers after worker completes.

- **guardian** - dedicated standards and scope enforcer that knows what you like.

- **maester** - metacognition layer; reviews whole process and surfaces optimizations.

- **deckbuilder** - optionally called by the controller to write specs/reports as html.

## Why I should use this

know-how sort of goes against the spirit of pi, and the joy in using it for me comes from building these tools myself. That said, you might find yourself wanting to try pi, but not having the time to build a whole thing.

This was created by cherry-picking great ideas from other sources, and hopefully there are ideas in here worth stealing for your version.

## Docs

- [Config](docs/config.md)
- [Shoutouts](docs/shoutouts.md)

## Install

```bash
./scripts/install
```

Run `./scripts/install` again to update the bundle.

## Uninstall

```bash
./scripts/uninstall
```

## Installed layout

```text
~/.pi/agent/extensions/know-how.ts
~/.pi/agent/skills/know-how/
```
