import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveEditorCommand, EDITOR_PRIORITY, OS_FALLBACK } from "../extension/tools/resolve-editor-command";

describe("resolveEditorCommand", () => {
  it("openCommandSet_returnsConfiguredCommandVerbatim", () => {
    const result = resolveEditorCommand("phpstorm .", [], "darwin");
    assert.strictEqual(result.command, "phpstorm .");
    assert.strictEqual(result.tip, undefined);
  });

  it("openCommandUnset_codeInPath_returnsCodeDot", () => {
    const editor = EDITOR_PRIORITY[0];
    const result = resolveEditorCommand(undefined, [editor], "darwin");
    assert.strictEqual(result.command, `${editor} .`);
    assert.strictEqual(result.tip, undefined);
  });

  it("openCommandUnset_phpstormInPath_returnsPhpstormDot", () => {
    const editor = EDITOR_PRIORITY.find((e) => e === "phpstorm")!;
    const result = resolveEditorCommand(undefined, [editor], "darwin");
    assert.strictEqual(result.command, `${editor} .`);
    assert.strictEqual(result.tip, undefined);
  });

  it("openCommandUnset_codeAndPhpstormInPath_returnsCodeDot", () => {
    const highPriority = EDITOR_PRIORITY[0];
    const lowerPriority = EDITOR_PRIORITY.find((e) => e === "phpstorm")!;
    const result = resolveEditorCommand(undefined, [lowerPriority, highPriority], "darwin");
    assert.strictEqual(result.command, `${highPriority} .`);
    assert.strictEqual(result.tip, undefined);
  });

  it("openCommandUnset_nothingDetected_macOS_returnsOpenDot", () => {
    const result = resolveEditorCommand(undefined, [], "darwin");
    assert.strictEqual(result.command, OS_FALLBACK["darwin"]);
    assert.ok(result.tip !== undefined, "should include a tip");
    assert.ok(result.tip!.includes("openCommand"), "tip should mention openCommand");
  });

  it("openCommandUnset_nothingDetected_linux_returnsXdgOpenDot", () => {
    const result = resolveEditorCommand(undefined, [], "linux");
    assert.strictEqual(result.command, OS_FALLBACK["linux"]);
    assert.ok(result.tip !== undefined);
    assert.ok(result.tip!.includes("openCommand"), "tip should mention openCommand");
  });

  it("openCommandUnset_nothingDetected_windows_returnsStartDot", () => {
    const result = resolveEditorCommand(undefined, [], "win32");
    assert.strictEqual(result.command, OS_FALLBACK["win32"]);
    assert.ok(result.tip !== undefined);
    assert.ok(result.tip!.includes("openCommand"), "tip should mention openCommand");
  });
});
