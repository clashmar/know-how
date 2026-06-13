import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { registerSelfCheck, SELF_CHECK_PROMPT, CHECKLIST_ITEM } from "../extension/self-check/agent-end-checklist";

type Handler = (event: unknown) => unknown;

/** Minimal fake of the bits of ExtensionAPI the self-check uses. */
function makeFakePi() {
  const handlers = new Map<string, Handler[]>();
  const sent: string[] = [];
  const pi = {
    on(event: string, handler: Handler) {
      const list = handlers.get(event) ?? [];
      list.push(handler);
      handlers.set(event, list);
    },
    sendUserMessage(content: string) {
      sent.push(content);
    },
  };
  const fire = async (event: string, payload?: unknown) => {
    for (const handler of handlers.get(event) ?? []) await handler(payload);
  };
  return { pi: pi as unknown as ExtensionAPI, sent, fire };
}

/** Drives one prompt that edits a file and finishes. */
async function editAndEnd(fire: (event: string, payload?: unknown) => Promise<void>, callId: string, isError = false) {
  await fire("agent_start");
  await fire("tool_call", { toolName: "edit", toolCallId: callId });
  await fire("tool_execution_end", { toolCallId: callId, isError });
  await fire("agent_end");
}

describe("SELF_CHECK_PROMPT", () => {
  it("alwaysIncludesTestsItem", () => {
    assert.ok(SELF_CHECK_PROMPT.includes(CHECKLIST_ITEM.tests));
  });

  it("alwaysIncludesCommentsItem", () => {
    assert.ok(SELF_CHECK_PROMPT.includes(CHECKLIST_ITEM.comments));
  });

  it("alwaysIncludesPlacementItem", () => {
    assert.ok(SELF_CHECK_PROMPT.includes(CHECKLIST_ITEM.placement));
  });

  it("alwaysIncludesConventionsItem", () => {
    assert.ok(SELF_CHECK_PROMPT.includes(CHECKLIST_ITEM.conventions));
  });
});

describe("registerSelfCheck gating", () => {
  it("successfulEditThenEnd_sendsOneCheck", async () => {
    const { pi, sent, fire } = makeFakePi();
    registerSelfCheck(pi);
    await editAndEnd(fire, "id1");
    assert.strictEqual(sent.length, 1);
  });

  it("successfulEditThenEnd_sendsTheChecklistPrompt", async () => {
    const { pi, sent, fire } = makeFakePi();
    registerSelfCheck(pi);
    await editAndEnd(fire, "id1");
    assert.strictEqual(sent[0], SELF_CHECK_PROMPT);
  });

  it("endWithoutEdit_sendsNothing", async () => {
    const { pi, sent, fire } = makeFakePi();
    registerSelfCheck(pi);
    await fire("agent_start");
    await fire("agent_end");
    assert.strictEqual(sent.length, 0);
  });

  it("erroredEditThenEnd_sendsNothing", async () => {
    const { pi, sent, fire } = makeFakePi();
    registerSelfCheck(pi);
    await editAndEnd(fire, "id1", true);
    assert.strictEqual(sent.length, 0);
  });

  it("readOnlyToolThenEnd_sendsNothing", async () => {
    const { pi, sent, fire } = makeFakePi();
    registerSelfCheck(pi);
    await fire("agent_start");
    await fire("tool_call", { toolName: "read", toolCallId: "id1" });
    await fire("tool_execution_end", { toolCallId: "id1", isError: false });
    await fire("agent_end");
    assert.strictEqual(sent.length, 0);
  });

  it("fixUpTurnAfterCheck_doesNotResend", async () => {
    const { pi, sent, fire } = makeFakePi();
    registerSelfCheck(pi);
    await editAndEnd(fire, "id1");
    await editAndEnd(fire, "id2");
    assert.strictEqual(sent.length, 1);
  });
});

describe("registerSelfCheck inside a subagent", () => {
  beforeEach(() => {
    process.env.PI_SUBAGENT_CHILD = "1";
  });

  afterEach(() => {
    delete process.env.PI_SUBAGENT_CHILD;
  });

  it("subagentChild_sendsNothing", async () => {
    const { pi, sent, fire } = makeFakePi();
    registerSelfCheck(pi);
    await editAndEnd(fire, "id1");
    assert.strictEqual(sent.length, 0);
  });
});
