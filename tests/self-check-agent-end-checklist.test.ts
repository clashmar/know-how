import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { registerSelfCheck, SELF_CHECK_PROMPT, CHECKLIST_ITEM } from "../extension/self-check/agent-end-checklist";

type Handler = (event: unknown, ctx?: unknown) => unknown;

/** Minimal fake of the bits of ExtensionAPI the self-check uses. */
function makeFakePi() {
  const handlers = new Map<string, Handler[]>();
  const pi = {
    on(event: string, handler: Handler) {
      const list = handlers.get(event) ?? [];
      list.push(handler);
      handlers.set(event, list);
    },
    sendMessage() {
      throw new Error("registerSelfCheck should inject via context, not sendMessage");
    },
    sendUserMessage() {
      throw new Error("registerSelfCheck should not send user messages");
    },
  };
  const fire = async (event: string, payload?: unknown, ctx?: unknown) => {
    const results: unknown[] = [];
    for (const handler of handlers.get(event) ?? []) {
      results.push(await handler(payload, ctx));
    }
    return results;
  };
  return { pi: pi as unknown as ExtensionAPI, fire };
}

/** Drives one turn that edits a file and finishes. */
async function editTurn(
  fire: (event: string, payload?: unknown, ctx?: unknown) => Promise<unknown[]>,
  callId: string,
  isError = false,
) {
  await fire("turn_start", { turnIndex: 0, timestamp: Date.now() }, { signal: new AbortController().signal });
  await fire("tool_call", { toolName: "edit", toolCallId: callId });
  await fire("tool_execution_end", { toolCallId: callId, isError });
  await fire("turn_end", { turnIndex: 0, message: undefined, toolResults: [] });
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
  it("successfulEditTurn_nextContextInjectsOneCheck", async () => {
    const { pi, fire } = makeFakePi();
    registerSelfCheck(pi);
    await fire("agent_start");
    await editTurn(fire, "id1");
    const [result] = await fire("context", { messages: [] });
    assert.ok(result && typeof result === "object");
    const messages = (result as { messages?: Array<{ content: string }> }).messages;
    assert.strictEqual(messages?.length, 1);
  });

  it("successfulEditTurn_nextContextInjectsTheChecklistPrompt", async () => {
    const { pi, fire } = makeFakePi();
    registerSelfCheck(pi);
    await fire("agent_start");
    await editTurn(fire, "id1");
    const [result] = await fire("context", { messages: [] });
    const messages = (result as { messages?: Array<{ content: string }> }).messages;
    assert.strictEqual(messages?.[0]?.content, SELF_CHECK_PROMPT);
  });

  it("successfulEditTurn_contextInjectionUsesHiddenCustomMessage", async () => {
    const { pi, fire } = makeFakePi();
    registerSelfCheck(pi);
    await fire("agent_start");
    await editTurn(fire, "id1");
    const [result] = await fire("context", { messages: [] });
    const message = (result as {
      messages?: Array<{
        role: string;
        customType?: string;
        content: string;
        display?: boolean;
        timestamp: number;
      }>;
    }).messages?.[0];
    assert.deepStrictEqual(message, {
      role: "custom",
      customType: "know-how:self-check",
      content: SELF_CHECK_PROMPT,
      display: false,
      timestamp: message?.timestamp,
    });
  });

  it("endWithoutEdit_sendsNothing", async () => {
    const { pi, fire } = makeFakePi();
    registerSelfCheck(pi);
    await fire("agent_start");
    await fire("agent_end");
    const [result] = await fire("context", { messages: [] });
    assert.strictEqual(result, undefined);
  });

  it("erroredEditTurn_sendsNothing", async () => {
    const { pi, fire } = makeFakePi();
    registerSelfCheck(pi);
    await fire("agent_start");
    await editTurn(fire, "id1", true);
    const [result] = await fire("context", { messages: [] });
    assert.strictEqual(result, undefined);
  });

  it("readOnlyTurn_sendsNothing", async () => {
    const { pi, fire } = makeFakePi();
    registerSelfCheck(pi);
    await fire("agent_start");
    await fire("turn_start", { turnIndex: 0, timestamp: Date.now() }, { signal: new AbortController().signal });
    await fire("tool_call", { toolName: "read", toolCallId: "id1" });
    await fire("tool_execution_end", { toolCallId: "id1", isError: false });
    await fire("turn_end", { turnIndex: 0, message: undefined, toolResults: [] });
    const [result] = await fire("context", { messages: [] });
    assert.strictEqual(result, undefined);
  });

  it("nonEditTurnAfterEditTurn_doesNotInjectAnotherCheck", async () => {
    const { pi, fire } = makeFakePi();
    registerSelfCheck(pi);
    await fire("agent_start");
    await editTurn(fire, "id1");
    await fire("context", { messages: [] });
    await fire("message_start", { message: { role: "user", content: [{ type: "text", text: "commit message?" }] } });
    await fire("turn_start", { turnIndex: 1, timestamp: Date.now() }, { signal: new AbortController().signal });
    await fire("turn_end", { turnIndex: 1, message: undefined, toolResults: [] });
    const [result] = await fire("context", { messages: [] });
    assert.strictEqual(result, undefined);
  });

  it("abortedSignal_sendsNothing", async () => {
    const { pi, fire } = makeFakePi();
    registerSelfCheck(pi);
    await fire("agent_start");
    const controller = new AbortController();
    controller.abort();
    await fire("turn_start", { turnIndex: 0, timestamp: Date.now() }, { signal: controller.signal });
    await fire("tool_call", { toolName: "edit", toolCallId: "id1" });
    await fire("tool_execution_end", { toolCallId: "id1", isError: false });
    await fire("turn_end", { turnIndex: 0, message: undefined, toolResults: [] });
    const [result] = await fire("context", { messages: [] });
    assert.strictEqual(result, undefined);
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
    const { pi, fire } = makeFakePi();
    registerSelfCheck(pi);
    await fire("agent_start");
    await editTurn(fire, "id1");
    const [result] = await fire("context", { messages: [] });
    assert.strictEqual(result, undefined);
  });
});
