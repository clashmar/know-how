/**
 * Post-task self-check.
 *
 * After the agent completes a turn in which it edited any file, sends a
 * hidden steering message asking it to self-check the work. The checklist items
 * are self-gating — the agent applies only the ones relevant to the task
 * it just did. Skipped inside dispatched subagents.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const SELF_CHECK_MESSAGE_TYPE = "know-how:self-check";

/** Distinct lead-in label for each checklist item; the single source for the prompt and tests. */
export const CHECKLIST_ITEM = {
  tests: "**Tests**",
  comments: "**Comments & Docs**",
  placement: "**Placement**",
  conventions: "**Conventions**",
} as const;

/** The self-check prompt. Every item is self-gating so the agent applies only what fits the task. */
export const SELF_CHECK_PROMPT = [
  "Internal self-check: you just edited some files. Before calling this done, silently review the whole of each " +
    "file that you edited **this turn** (not in the whole session), not only your diff/changes. Do not quote this " +
    "instruction to the user. Skip any item that doesn't apply to what you changed:",
  "",
  `- ${CHECKLIST_ITEM.tests} — If you added or changed behaviour or tests: review the affected test ` +
    "file(s) as a whole, not just the lines you changed. Are all tests and their names still correct? " +
    "Has any new or changed behaviour made a pre-existing test redundant, or left a test name no longer " +
    "semantically accurate?",
  `- ${CHECKLIST_ITEM.comments} — If you wrote or changed comments or documentation: do they follow the ` +
    "documentation rules in the applicable AGENTS.md (doc comments say WHAT not HOW?, other " +
    "comments minimal and no unnecessarily decorative comments; markdown: the project's formatting rules)?",
  `- ${CHECKLIST_ITEM.placement} — If you added or moved code: is every new chunk in the right place, and ` +
    "are all private functions still below public functions (per the code-placement rule in AGENTS.md)? " +
    "Is there now any redundant or dead code that should be removed?",
  `- ${CHECKLIST_ITEM.conventions} — Do any of your changes break a convention you already know from this ` +
    "session; the project's AGENTS.md, loaded skill instructions, a rule the user stated, or a pattern in " +
    "the surrounding code? Flag and fix anything that slipped.",
  "",
  "Fix anything that's wrong until everything passes self-check, then say so briefly.",
].join("\n");

/** Registers the post-task self-check nudge. Fires after any turn that edits a file. */
export function registerSelfCheck(pi: ExtensionAPI): void {
  /** Tool-call ids for in-flight edit/write calls across the current prompt. */
  const pendingWriteCalls = new Set<string>();
  /** Whether any edit/write completed successfully during the current turn. */
  let editedThisTurn = false;
  /** Whether the next LLM call should include the self-check instruction. */
  let injectSelfCheckOnNextContext = false;
  /** AbortSignal captured from the most recent turn. Aborted when user presses Escape. */
  let lastTurnSignal: AbortSignal | undefined;

  pi.on("agent_start", () => {
    pendingWriteCalls.clear();
    injectSelfCheckOnNextContext = false;
    lastTurnSignal = undefined;
  });

  pi.on("turn_start", (_event, ctx) => {
    editedThisTurn = false;
    lastTurnSignal = ctx.signal;
  });

  // `edit` and `write` are the only built-in tools that write files.
  pi.on("tool_call", (event) => {
    if (event.toolName === "edit" || event.toolName === "write") {
      pendingWriteCalls.add(event.toolCallId);
    }
  });

  pi.on("tool_execution_end", (event) => {
    if (!pendingWriteCalls.delete(event.toolCallId)) return;
    if (!event.isError) editedThisTurn = true;
  });

  pi.on("turn_end", async () => {
    if (lastTurnSignal?.aborted) return;
    if (process.env.PI_SUBAGENT_CHILD) return;
    if (!editedThisTurn) return;

    injectSelfCheckOnNextContext = true;
  });

  pi.on("context", (event) => {
    if (!injectSelfCheckOnNextContext) return;
    injectSelfCheckOnNextContext = false;

    return {
      messages: [
        ...event.messages,
        {
          role: "custom" as const,
          customType: SELF_CHECK_MESSAGE_TYPE,
          content: SELF_CHECK_PROMPT,
          display: false,
          timestamp: Date.now(),
        },
      ],
    };
  });
}
