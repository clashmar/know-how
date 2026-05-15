import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ENABLE_WRITE_MODE_VALUE,
  STAY_READ_MODE_VALUE,
  ensureWriteModeForAction,
} from "../extension/write-mode/approval";
import type { WriteModeApprovalDeps } from "../extension/write-mode/approval";
import { CANCELLED_SENTINEL } from "../extension/write-mode/signals";

function mockDeps(overrides?: Partial<WriteModeApprovalDeps>) {
  const enableWriteModeCalls: number[] = [];
  const presentChoiceCalls: { title: string; options: { label: string; value: string }[] }[] = [];
  return {
    deps: {
      isReadMode: overrides?.isReadMode ?? (() => true),
      isRoleLocked: overrides?.isRoleLocked ?? (() => false),
      enableWriteMode: overrides?.enableWriteMode ?? (() => { enableWriteModeCalls.push(0); }),
      presentChoice:
        overrides?.presentChoice ??
        (async (_params) => {
          presentChoiceCalls.push({ title: _params.title, options: _params.options });
          return ENABLE_WRITE_MODE_VALUE;
        }),
    },
    enableWriteModeCalls,
    presentChoiceCalls,
  };
}

describe("ensureWriteModeForAction", () => {
  it("ensureWriteModeForActionAcceptPathCallsEnableWriteMode", async () => {
    const { deps, enableWriteModeCalls, presentChoiceCalls } = mockDeps();

    const outcome = await ensureWriteModeForAction(deps, {
      title: "Enable write mode?",
      actionLabel: "Switch to write mode",
      reason: "Need to create files",
    });

    assert.strictEqual(enableWriteModeCalls.length, 1, "enableWriteMode should be called once");
    assert.strictEqual(presentChoiceCalls.length, 1, "presentChoice should be called once");
    assert.strictEqual(presentChoiceCalls[0].title, "Enable write mode?");
    assert.deepStrictEqual(presentChoiceCalls[0].options, [
      { label: "Switch to write mode", value: ENABLE_WRITE_MODE_VALUE, description: "Need to create files" },
      { label: "Stay in read mode", value: STAY_READ_MODE_VALUE },
    ]);
    assert.deepStrictEqual(outcome, { result: "enabled" });
  });

  it("ensureWriteModeForActionStayReadModeReturnsDeclined", async () => {
    const { deps, enableWriteModeCalls } = mockDeps({
      presentChoice: async () => STAY_READ_MODE_VALUE,
    });

    const outcome = await ensureWriteModeForAction(deps, {
      title: "Enable write mode?",
      actionLabel: "Switch to write mode",
      reason: "Need to create files",
    });

    assert.strictEqual(enableWriteModeCalls.length, 0, "enableWriteMode should NOT be called");
    assert.deepStrictEqual(outcome, { result: "declined" });
  });

  it("ensureWriteModeForActionDeclinePathReturnsDeclined", async () => {
    const { deps, enableWriteModeCalls } = mockDeps({
      presentChoice: async () => null,
    });

    const outcome = await ensureWriteModeForAction(deps, {
      title: "Enable write mode?",
      actionLabel: "Switch to write mode",
      reason: "Need to create files",
    });

    assert.strictEqual(enableWriteModeCalls.length, 0, "enableWriteMode should NOT be called");
    assert.deepStrictEqual(outcome, { result: "declined" });
  });

  it("ensureWriteModeForActionDeclinePathReturnsDeclined when sentinel is CANCELLED_SENTINEL", async () => {
    const { deps, enableWriteModeCalls } = mockDeps({
      presentChoice: async () => CANCELLED_SENTINEL,
    });

    const outcome = await ensureWriteModeForAction(deps, {
      title: "Enable write mode?",
      actionLabel: "Switch to write mode",
      reason: "Need to create files",
    });

    assert.strictEqual(enableWriteModeCalls.length, 0, "enableWriteMode should NOT be called");
    assert.deepStrictEqual(outcome, { result: "declined" });
  });

  it("ensureWriteModeForActionFreeTextReturnsDeferredNote", async () => {
    const { deps, enableWriteModeCalls } = mockDeps({
      presentChoice: async () => "I'll do it manually",
    });

    const outcome = await ensureWriteModeForAction(deps, {
      title: "Enable write mode?",
      actionLabel: "Switch to write mode",
      reason: "Need to create files",
    });

    assert.strictEqual(enableWriteModeCalls.length, 0, "enableWriteMode should NOT be called");
    assert.deepStrictEqual(outcome, { result: "deferred", note: "I'll do it manually" });
  });

  it("ensureWriteModeForActionRoleLockedReturnsRoleLocked", async () => {
    let presentChoiceCalled = false;
    const { deps, enableWriteModeCalls } = mockDeps({
      isRoleLocked: () => true,
      presentChoice: async () => {
        presentChoiceCalled = true;
        return ENABLE_WRITE_MODE_VALUE;
      },
    });

    const outcome = await ensureWriteModeForAction(deps, {
      title: "Enable write mode?",
      actionLabel: "Switch to write mode",
      reason: "Need to create files",
    });

    assert.strictEqual(enableWriteModeCalls.length, 0, "enableWriteMode should NOT be called");
    assert.strictEqual(presentChoiceCalled, false, "presentChoice should NOT be called");
    assert.deepStrictEqual(outcome, { result: "role-locked" });
  });

  it("ensureWriteModeForActionWriteModeSkipsPrompt", async () => {
    let presentChoiceCalled = false;
    const { deps, enableWriteModeCalls } = mockDeps({
      isReadMode: () => false,
      presentChoice: async () => {
        presentChoiceCalled = true;
        return ENABLE_WRITE_MODE_VALUE;
      },
    });

    const outcome = await ensureWriteModeForAction(deps, {
      title: "Enable write mode?",
      actionLabel: "Switch to write mode",
      reason: "Need to create files",
    });

    assert.strictEqual(enableWriteModeCalls.length, 0, "enableWriteMode should NOT be called");
    assert.strictEqual(presentChoiceCalled, false, "presentChoice should NOT be called");
    assert.deepStrictEqual(outcome, { result: "already-write" });
  });
});

describe("constants", () => {
  it("ENABLE_WRITE_MODE_VALUE is __enable-write-mode__", () => {
    assert.strictEqual(ENABLE_WRITE_MODE_VALUE, "__enable-write-mode__");
  });

  it("STAY_READ_MODE_VALUE is __stay-read-mode__", () => {
    assert.strictEqual(STAY_READ_MODE_VALUE, "__stay-read-mode__");
  });
});
