---
name: closing-out-work
description: Use when implementation is complete, verification is passing, and you need to close out the work with cleanup, review, process optimization, reflection, and final integration choices
---

# Closing Out Work

## Overview

Close out implementation by verifying it, giving the testing artifacts, cleaning up residual artifacts, anticipating likely feedback, asking the user to review the work, presenting final integration options, then optimizing and reflecting on the process.

**Core principle:** Verify -> help user testing -> clean up -> anticipate feedback -> ask for review -> feedback loop if needed -> integrate -> optimize and reflect.

**Announce at start:** "I'm using the closing-out-work skill to complete this work. Verifying state before moving on to feedback, final integration options, then process optimization and reflection."

## The Process

### Step 1: Verify Completion State

Verification must pass before proceeding.

Run the relevant verification for the work you just completed. If tests, builds, lint, or required checks fail, stop and fix that first.

Even if the scenario says tests already pass, explicitly confirm the completion state before moving on. Do not treat that prompt detail as permission to skip this step.

```bash
# Run the project's required verification
npm test / cargo test / pytest / go test ./...
```

If verification fails, do not continue to integration decisions or cleanup shortcuts.

### Step 2: Prepare Manual Verification Artifacts

Before moving to integration context, prepare manual verification artifacts
for the human reviewer.

- Gather the observable output produced by the plan's verification commands
  (log output, curl responses, diffs, screenshots). Present them with clear
  success/failure annotations.
- For each check in the plan's testing approach, state what the reviewer
  should look for and what the expected outcome is.
- If a check is easy for the agent to run (logging commands, diffs, trivial
  curl calls), run it and include the result so the reviewer doesn't have to.
- If a check requires human judgment (UI layout, visual polish, subjective
  correctness), note the success criteria and leave it for the reviewer.

This step produces a review-ready artifact: a checklist of "verify this"
items with either pre-confirmed results or clear expectations for what a
human should see. The goal is to make review as fast and confident as
possible.

### Step 3: Determine Integration Context

Determine the current branch and base branch early so later options are grounded in the actual repo state.

Do this before cleanup, review, or PR talk so the close-out work stays tied to the real branch context instead of assumptions.

```bash
# Identify current branch
git branch --show-current

# Detect if we're working in a worktree
# This should match the plan's declared Worktree Strategy:
#   - "Worktree" → we created a worktree from the current branch at the start
#   - "Direct" → we stayed on the current branch
# If the plan declared Worktree, verify the worktree exists.
# If the plan declared Direct, we should NOT be in a worktree.
git worktree list
# If the current path shows "(detached)" or is a worktree path,
# store the original branch (the one visible from the main repo)
# and note: "Working in a worktree — will merge back on close-out."

# Infer a likely base branch name
git symbolic-ref refs/remotes/origin/HEAD --short 2>/dev/null | sed 's#^origin/##'
```

If that does not return one clear branch name, check common local branch names like `main` or `master`. If the likely base branch is still unclear, ask the user before continuing.

### Step 4: Check For Residual Artifacts

Before asking for review or showing options, inspect the work for leftovers that should not ride along just because verification passed.

Check explicitly for:

- temp files from testing or manual experiments
- generated leftovers that should be removed or regenerated cleanly
- redundant code from earlier iterations
- unused fixtures, test helpers, or sample data

If obvious residual artifacts exist, clean them up now and re-run verification as needed.
Ensure no new artifacts are introduced during cleanup.

### Step 5: Anticipate Feedback And Polish

Review the completed work once more before asking the user to look at it.

Ask yourself: what is a careful reviewer likely to flag next?

Look for:

- violations of style or conventions that should be fixed before review
- unclear naming or structure
- missing cleanup from the final implementation
- small follow-up fixes that are faster to address now than in review
- Can a reviewer independently verify correctness without running the code?
  If not, add logging, observable output, or a verification command
  before proceeding.

If you change anything here, return to verification before moving on.

### Step 6: Ask The User To Review The Work

Ask the user to review the work now that verification, cleanup, and polish are complete.

### Step 7: Handle Feedback Loop

If the user gives feedback, route back through the same gates in order:

1. Apply the feedback
2. Re-run verification
3. Re-check for residual artifacts
4. Re-evaluate likely reviewer feedback and polish
5. Ask the user to review again

Do not skip back directly to next options after making changes.

Once the user approves the work, proceed to integration.

### Step 8: Present Final Options After User Confirmation

Present the user with final integration options using the `present_choice` tool.
`present_choice` auto-adds `Something else...`; do not add a duplicate. `otherLabel` renames it, so keep it short.

**If the plan declared `Worktree Strategy: Worktree`** (detected in Step 3), call `present_choice` with:

- **title:** "Final integration"
- **options:**
  - Merge + Commit — value: "merge-commit"
  - Merge, Commit, Push + PR — value: "merge-pr"
  - Merge, keep branch as-is — value: "merge-keep"
  - Skip — value: "skip"

**If the plan declared `Worktree Strategy: Direct`** (or worktree merge is already done), call `present_choice` with:

- **title:** "Final integration"
- **options:**
  - Commit changes — value: "commit"
  - Commit, Push + PR — value: "pr"
  - Keep branch as-is — value: "keep"

**Do not execute any git write operations until the user selects an option.**

### Step 9: Execute The Chosen Option

**These git write operations are executed only after the user explicitly chooses an option in Step 8.** Do not run any git write commands before the user confirms.

#### Worktree Strategy: Worktree — Merge First

For Options 1-3, merge the worktree branch back to the original repo first:

```bash
# From the original repo (not the worktree)
cd $REPO_ROOT
git merge <worktree-branch>

# Clean up the worktree
git worktree remove ../<worktree-branch>
git branch -d <worktree-branch>  # optional, branch is merged
```

#### Option 1: Commit changes

```bash
# Commit changes using this template: type(domain): brief summary of what this work commits
git commit -m "<commit-message>"
```

#### Option 2: Commit, Push and Create PR

```bash
# Commit changes using this template: type(domain): brief summary of what this work commits
git commit -m "<commit-message>"

# Push branch
git push -u origin <feature-branch>

# Create PR
gh pr create --title "<title>" --body "$(cat <<'EOF'
## Summary
<2-3 bullets of what changed>

## Test Plan
- [ ] <verification steps>
EOF
)"
```

Then report completion and the resulting PR or branch state.

#### Option 3: Keep As-Is

Report: "Keeping branch <name> as-is."

Then report completion and the resulting branch state.

### Step 10: Maester Optimization

1. Dispatch EXACTLY ONE `maester` agent to perform process optimization and memory
   stewardship at close-out.

   Fill in all `<…>` placeholders from this session's context, then dispatch
   (see `./maester-prompt.md`).

2. The maester produces a process optimization report:
   - De-duplicated optimization suggestions (same gap flagged in multiple
     tasks → one recommendation)
   - Stale-memory audit (contradictions, duplicates, superseded facts)
   - Cross-session auto-surfaces (gaps flagged 3+ times across sessions)
3. Before any per-suggestion approval UI, call `present_choice` with title `Optimization report format` and options:
   - HTML report — value: `html`
   - Inline findings — value: `inline`
   `present_choice` auto-adds `Something else...`; do not add a duplicate. `otherLabel` renames it, so keep it short.
4. If the human chooses `HTML report`:
   - Read `./optimization-report-prompt.md`
   - Fill in the prompt with the maester findings and current session context
   - Dispatch `deckbuilder` to save a persistent report at `~/.know-how/<project-name>/reports/YYYY-MM-DD-<topic>-optimization-report.html`
   - Present the saved report as a short markdown link before continuing
5. If the human chooses `Inline findings`, present the same report content inline before continuing:
   - Cross-session auto-surfaces first
   - De-duplicated optimization suggestions with enough evidence to make a decision
   - Stale-memory audit findings
6. After the report is shown, present the maester suggestions to the human as actionable decision points.
7. For each maester suggestion, call `present_choice` with title matching the suggestion summary and options: Apply / Edit / Skip.
   `present_choice` auto-adds `Something else...`; do not add a duplicate. `otherLabel` renames it, so keep it short.
8. For approved suggestions:
   - Apply the doc/memory/skill changes
9. Re-run verification if project docs were changed.

<HARD-GATE>
  Surface all maester suggestions, you do not have discretion to skip any. 
  If the maester flags an optimization, you must present it to the user and ask for approval to apply it. 
  Do not skip or ignore maester suggestions.
</HARD-GATE>  

### Step 11: Reflect

Once integration is complete, use the `session-reflection` skill to record 
key decisions, user corrections, and recurring problems from this work.

The reflection should cover everything from this work unit:

- Decisions made and why
- Any user corrections or steering received
- Mistakes and their fixes
- Patterns that recurred (check prior reflections in
  `~/.know-how/<project>/reflections/`)
- Remaining work or follow-ups

Persist key decisions and lessons to pi-memory via `memory_remember`.
Remove any stale facts via `memory_forget`.

<HARD-GATE>
  Do not skip reflection. Reflection is essential for learning and improvement.
</HARD-GATE>

## Common Mistakes

- Presenting options before user review
- Letting "tests already pass" justify skipping explicit verification or branch-context checks
- Letting a tempting fast path justify skipping cleanup, polish, or review
- Letting sunk-cost thinking justify skipping obvious cleanup or review

## Red Flags

Never:

- execute any git write operation (commit, push, merge, worktree remove, branch -D, stash, checkout --) before the user explicitly chooses an option in Step 8
- execute a worktree merge-back before the user confirms — the merge, worktree remove, and branch deletion are all git write operations that require explicit approval
- present commit/PR/keep options before user review
- treat “tests already pass” as permission to skip explicit completion-state verification
- treat time pressure or a tempting fast path as permission to skip determining branch and base-branch context
- skip residual artifact checks because “tests already pass”
- treat sunk-cost or “already basically done” reasoning as a reason to skip obvious cleanup, polish, or review
- assume the work is finished without asking what a careful reviewer is likely to flag next
- treat cleanup or polish as optional when obvious issues are already visible
- discard work without typed confirmation

Always:

- get verification passing first
- sweep for residual artifacts before review
- ask the user to review before presenting final options
- loop back through verification, cleanup, polish, and review after feedback

## Prompt Templates

- `./maester-prompt.md` — Dispatch maester for close-out optimization report

## Integration

Use this skill after implementation is complete and verification is already in good shape, when the remaining work is to close out the work responsibly and then choose how to integrate it.
