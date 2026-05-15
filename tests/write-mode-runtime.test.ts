import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import {
  activateApprovedWriteMode,
  registerApprovedWriteModeActivator,
} from "../extension/write-mode/runtime";

function createStubContext(): ExtensionContext {
  return {} as ExtensionContext;
}

describe("activateApprovedWriteMode", () => {
  it("activateApprovedWriteModeWithoutRegisteredActivatorReturnsFalse", () => {
    const result = activateApprovedWriteMode(createStubContext());
    assert.strictEqual(result, false);
  });

  it("activateApprovedWriteModeAfterRegisterCallsStoredActivator", () => {
    const seenContexts: ExtensionContext[] = [];
    registerApprovedWriteModeActivator((ctx) => {
      seenContexts.push(ctx);
    });

    const ctx = createStubContext();
    const result = activateApprovedWriteMode(ctx);

    assert.strictEqual(result, true);
    assert.deepStrictEqual(seenContexts, [ctx]);
  });
});
