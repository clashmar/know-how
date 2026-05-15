import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CANCELLED_SENTINEL,
  ENABLE_WRITE_MODE_VALUE,
  STAY_READ_MODE_VALUE,
  isWriteModeEnableSelection,
} from "../extension/write-mode/signals";

describe("isWriteModeEnableSelection", () => {
  it("isWriteModeEnableSelectionCanonicalValueReturnsTrue", () => {
    assert.strictEqual(isWriteModeEnableSelection(ENABLE_WRITE_MODE_VALUE), true);
  });

  it("isWriteModeEnableSelectionFriendlyPromptLabelsReturnTrue", () => {
    assert.strictEqual(isWriteModeEnableSelection("Switch to write mode"), true);
    assert.strictEqual(isWriteModeEnableSelection("switch-write"), true);
    assert.strictEqual(isWriteModeEnableSelection("enable-write"), true);
    assert.strictEqual(isWriteModeEnableSelection("Enable write mode"), true);
  });

  it("isWriteModeEnableSelectionNonApprovalValuesReturnFalse", () => {
    assert.strictEqual(isWriteModeEnableSelection(STAY_READ_MODE_VALUE), false);
    assert.strictEqual(isWriteModeEnableSelection(CANCELLED_SENTINEL), false);
    assert.strictEqual(isWriteModeEnableSelection("Something else..."), false);
  });
});
