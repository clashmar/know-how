/**
 * Post-task self-check.
 *
 * After the agent finishes a prompt in which it edited any file, sends a
 * follow-up message asking it to self-check the work. The checklist items
 * are self-gating — the agent applies only the ones relevant to the task
 * it just did. Skipped inside dispatched subagents.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

/** Distinct lead-in label for each checklist item; the single source for the prompt and tests. */
export const CHECKLIST_ITEM = {
  tests: "**Tests**",
  comments: "**Comments & Docs**",
  placement: "**Placement**",
  conventions: "**Conventions**",
} as const;

/** The self-check prompt. Every item is self-gating so the agent applies only what fits the task. */
export const SELF_CHECK_PROMPT = [
  "You just edited files. Before calling this done, self-check the work — read the whole of each " +
    "changed file, not only your diff. Skip any item that doesn't apply to what you changed:",
  "",
  `- ${CHECKLIST_ITEM.tests} — If you added or changed behaviour or tests: review the affected test ` +
    "file(s) as a whole, not just the lines you changed. Are all tests and their names still correct? " +
    "Has any new or changed behaviour made a pre-existing test redundant, or left a test name no longer " +
    "semantically accurate?",
  `- ${CHECKLIST_ITEM.comments} — If you wrote or changed comments or documentation: do they follow the ` +
    "documentation rules in the applicable AGENTS.md (code: public-API JSDoc says WHAT not HOW, other " +
    "comments minimal; markdown: the project's formatting rules)?",
  `- ${CHECKLIST_ITEM.placement} — If you added or moved code: is every new chunk in the right place, and ` +
    "are all private functions still below public functions (per the code-placement rule in AGENTS.md)?",
  `- ${CHECKLIST_ITEM.conventions} — Do any of your changes break a convention you already know from this ` +
    "session — the project's AGENTS.md, loaded skill instructions, a rule the user stated, or a pattern in " +
    "the surrounding code? Flag and fix anything that slipped.",
  "",
  "Fix anything that's wrong. If everything passes self-check, say so briefly and stop.",
].join("\n");

/** Registers the post-task self-check nudge. Fires only after the agent edits a file. */
export function registerSelfCheck(pi: ExtensionAPI): void {
  /** Tool-call ids for in-flight edit/write calls this prompt. */
  const pendingWriteCalls = new Set<string>();
  /** Whether any edit/write completed successfully during the current prompt. */
  let editedThisPrompt = false;
  /** One-shot guard so the agent's fix-up turn doesn't re-trigger the check. */
  let suppressNextCheck = false;

  pi.on("agent_start", () => {
    pendingWriteCalls.clear();
    editedThisPrompt = false;
  });

  // `edit` and `write` are the only built-in tools that write files.
  pi.on("tool_call", (event) => {
    if (event.toolName === "edit" || event.toolName === "write") {
      pendingWriteCalls.add(event.toolCallId);
    }
  });

  pi.on("tool_execution_end", (event) => {
    if (!pendingWriteCalls.delete(event.toolCallId)) return;
    if (!event.isError) editedThisPrompt = true;
  });

  pi.on("agent_end", async () => {
    if (suppressNextCheck) {
      suppressNextCheck = false;
      return;
    }
    if (process.env.PI_SUBAGENT_CHILD) return;
    if (!editedThisPrompt) return;

    suppressNextCheck = true;
    pi.sendUserMessage(SELF_CHECK_PROMPT, { deliverAs: "followUp" });
  });
}
