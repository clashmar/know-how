import assert from "node:assert/strict";
import { existsSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { buildPiInvocation } from "../extension/subagents/invocation";

describe("buildPiInvocation", () => {
  it("buildPiInvocation_withReadsPrefixesTaskAndSendsPromptThroughStdin", () => {
    const tempRoot = path.join(os.tmpdir(), `subagent-invocation-${process.pid}-${Date.now()}`);
    const promptPath = path.join(tempRoot, "prompt.md");

    try {
      const invocation = buildPiInvocation({
        agentPrompt: "system prompt",
        task: "Review this diff",
        reads: ["src/feature.ts", "tests/feature.test.ts"],
        model: "github-copilot/gpt-5.5:high",
        promptDir: tempRoot,
      });

      assert.deepStrictEqual(invocation.args, [
        "--mode",
        "json",
        "-p",
        "--no-session",
        "--system-prompt",
        promptPath,
        "--model",
        "github-copilot/gpt-5.5:high",
      ]);
      assert.strictEqual(
        invocation.stdin,
        "[Read from: src/feature.ts, tests/feature.test.ts]\n\nReview this diff",
      );
      assert.strictEqual(existsSync(promptPath), true);
      assert.strictEqual(invocation.tempDir, tempRoot);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("buildPiInvocation_withoutPromptSkipsPromptFileAndStillUsesStdin", () => {
    const invocation = buildPiInvocation({
      agentPrompt: "",
      task: "Review this diff",
    });

    assert.deepStrictEqual(invocation.args, ["--mode", "json", "-p", "--no-session"]);
    assert.strictEqual(invocation.stdin, "Review this diff");
    assert.strictEqual(invocation.tempDir, undefined);
  });
});
