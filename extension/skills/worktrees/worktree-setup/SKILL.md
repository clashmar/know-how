---
name: worktree-setup
description: "Use when a plan declares Worktree Strategy: Worktree"
---

# Worktree Setup

Sets up an isolated git worktree for agent-driven development workflows.
Used by executing-plans and any workflow that needs filesystem
isolation without touching the main checkout.

## When to Use

When a plan declares `Worktree Strategy: Worktree`. Skip if the plan
says `Worktree Strategy: Direct` or if the repo can't support worktrees
(bare repo, submodule).

## Setup

```bash
# 1. Note where you are
CURRENT_BRANCH=$(git branch --show-current)
REPO_ROOT=$(git rev-parse --show-toplevel)

# 2. Check the working tree is clean
git status --porcelain
# If dirty: "Working tree has uncommitted changes. Commit them first
# (outside this workflow) or abort?"

# 3. Derive the project name from the git root directory name
#    e.g. /Users/lash/Personal/bishop → "bishop"
#    Sanitize: lowercase, hyphens for non-alphanumeric runs
PROJECT_NAME=$(basename "$REPO_ROOT" | tr '[:upper:]' '[:lower:]' |
  sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g; s/^-//; s/-$//')

# 4. Derive a raw branch name from the plan title (without project prefix)
#    e.g. plan title "Add Auth Refactor" → raw: "feature-auth-refactor"
#    Sanitize: lowercase, hyphens, no special chars
#    The project prefix is added by step 5 below
#    Example full result after step 5: "bishop-feature-auth-refactor"

# 5. Create the worktree from the current branch
git worktree add ../${PROJECT_NAME}-<branch-name> \
  -b ${PROJECT_NAME}-<branch-name> $CURRENT_BRANCH
```

**If a worktree for this branch already exists**, reuse it.

## Build immediately (background)

As soon as the worktree is created, start the project build in the background.
This saves time — the build runs while you implement, so the first verification
step doesn't wait on a cold build.

**Detect the build command** from project markers in the worktree:
- `Cargo.toml` → `cargo build`
- `package.json` → `npm ci && npm run build --if-present`
- `go.mod` → `go build ./...`
- `Makefile` → `make` (or `make build` if that target exists)

Or use the project's normal bootstrap command from its contributing docs.

**Run it in the background** so you can proceed with implementation:
```bash
cargo build &          # Rust
npm run build &        # Node
make &                 # Make-based projects
```

Do not wait for the build to finish. Start it and move on to implementation.
Treat build failures as a signal only: note them when you check the build output
later, and continue per plan/user guidance. This is a time-saver, not a gate.

## Working in the worktree

### Dispatching subagents (controller)

When dispatching subagents, set `cwd: /path/to/worktree` on the subagent
tool call so all subagents start in the worktree directory. File edits
and tests happen in the worktree. The original checkout stays untouched.

### Working directly (inline agent)

If the agent works directly (not via subagents), `cd` into the worktree
and work there.

## Git writes

Git write operations (commit, push, merge) are not performed during
execution. They are gated behind user review — at checkpoints (if
`Execution Autonomy: Checkpointed`) and at close-out via
`closing-out-work`.

## Fallback

If the repo can't support worktrees (bare repo, submodule), fall back to
working on the current branch regardless of the plan's Worktree Strategy.
