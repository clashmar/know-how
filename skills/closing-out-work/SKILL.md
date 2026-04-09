---
name: closing-out-work
description: Use when implementation is complete, verification is passing, and you need to close out the work with cleanup, review, and final integration choices
---

# Closing Out Work

## Overview

Close out implementation by verifying it, cleaning up residual artifacts, anticipating likely feedback, asking the user to review the work, and only after user confirmation presenting final integration options.

**Core principle:** Verify -> determine context -> clean up -> anticipate feedback -> ask for review -> feedback loop if needed -> then choose integration.

**Announce at start:** "I'm using the closing-out-work skill to complete this work."

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

### Step 2: Determine Integration Context

Determine the current branch and base branch early so later options are grounded in the actual repo state.

Do this before cleanup, review, or PR talk so the close-out work stays tied to the real branch context instead of assumptions.

```bash
# Identify current branch
git branch --show-current

# Infer a likely base branch name
git symbolic-ref refs/remotes/origin/HEAD --short 2>/dev/null | sed 's#^origin/##'
```

If that does not return one clear branch name, check common local branch names like `main` or `master`. If the likely base branch is still unclear, ask the user before continuing.

### Step 3: Check For Residual Artifacts

Before asking for review or showing options, inspect the work for leftovers that should not ride along just because verification passed.

Check explicitly for:
- temp files from testing or manual experiments
- generated leftovers that should be removed or regenerated cleanly
- redundant code from earlier iterations
- unused fixtures, test helpers, or sample data

If obvious residual artifacts exist, clean them up now and re-run verification as needed.
Ensure no new artifacts are introduced during cleanup.

### Step 4: Anticipate Feedback And Polish

Review the completed work once more before asking the user to look at it.

Ask yourself: what is a careful reviewer likely to flag next?

Look for:
- violations of style or conventions that should be fixed before review
- unclear naming or structure
- missing cleanup from the final implementation
- small follow-up fixes that are faster to address now than in review

If you change anything here, return to verification before moving on.

### Step 5: Ask The User To Review The Work

Ask the user to review the work now that verification, cleanup, and polish are complete.

Do not present merge, PR, keep, or discard options before the user has had a chance to review and confirm the work is ready.

### Step 6: Handle Feedback Loop

If the user gives feedback, route back through the same gates in order:
1. Apply the feedback
2. Re-run verification
3. Re-check for residual artifacts
4. Re-evaluate likely reviewer feedback and polish
5. Ask the user to review again

Do not skip back directly to final options after making changes.

### Step 7: Present Final Options After User Confirmation

Only after the user confirms the work looks good, present exactly these options:

1. Merge back to <base-branch> locally
2. Push and create a Pull Request
3. Keep the branch as-is (I'll handle it later)
4. Discard this work

Keep the options concise. Git is the final integration stage here, not the purpose of the skill.

### Step 8: Execute The Chosen Option

#### Option 1: Merge Locally

```bash
# Switch to base branch
git checkout <base-branch>

# Pull latest
git pull

# Merge feature branch
git merge <feature-branch>

# Verify tests on merged result
<test command>

# If tests pass
git branch -d <feature-branch>
```

Then report completion and the resulting branch state.

#### Option 2: Push and Create PR

```bash
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

#### Option 4: Discard

Confirm first:

```text
This will permanently delete:
- Branch <name>
- All commits: <commit-list>

Type 'discard' to confirm.
```

Wait for exact typed confirmation.

If confirmed:

```bash
git checkout <base-branch>
git branch -D <feature-branch>
```

Then report completion and the resulting branch state.

## Common Mistakes

- Presenting options before user review
- Letting "tests already pass" justify skipping explicit verification or branch-context checks
- Letting a tempting fast path justify skipping cleanup, polish, or review
- Letting sunk-cost thinking justify skipping obvious cleanup or review

## Red Flags

Never:
- present merge/PR/keep/discard options before user review
- treat "tests already pass" as permission to skip explicit completion-state verification
- treat time pressure or a tempting fast path as permission to skip determining branch and base-branch context
- skip residual artifact checks because "tests already pass"
- treat sunk-cost or "already basically done" reasoning as a reason to skip obvious cleanup, polish, or review
- assume the work is finished without asking what a careful reviewer is likely to flag next
- treat cleanup or polish as optional when obvious issues are already visible
- discard work without typed confirmation

Always:
- get verification passing first
- sweep for residual artifacts before review
- ask the user to review before presenting final options
- loop back through verification, cleanup, polish, and review after feedback

## Integration

Use this skill after implementation is complete and verification is already in good shape, when the remaining work is to close out the work responsibly and then choose how to integrate it.
