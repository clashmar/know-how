import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  appendBoundedTail,
  createResponseCollector,
  extractResponse,
} from "../extension/subagents/response-collector";

describe("appendBoundedTail", () => {
  it("appendBoundedTailKeepsOnlyTrailingCharactersWithinLimit", () => {
    assert.strictEqual(appendBoundedTail("abcd", "efgh", 6), "cdefgh");
  });

  it("appendBoundedTailPrefersChunkTailWhenChunkExceedsLimit", () => {
    assert.strictEqual(appendBoundedTail("abcd", "efghijkl", 4), "ijkl");
  });
});

describe("extractResponse", () => {
  it("extractResponseCollectsAssistantTextAcrossJsonlEvents", () => {
    const stdout = [
      JSON.stringify({
        type: "message_end",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "first line" }],
        },
      }),
      JSON.stringify({
        type: "message_end",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "second line" }],
        },
      }),
    ].join("\n");

    assert.deepStrictEqual(extractResponse(stdout), {
      text: "first line\nsecond line",
      error: undefined,
    });
  });

  it("extractResponseSurfacesErrorsFromErrorEventsAndAssistantStopReason", () => {
    const stdout = [
      JSON.stringify({
        type: "error",
        error: { message: "upstream failure" },
      }),
      JSON.stringify({
        type: "message_end",
        message: {
          role: "assistant",
          stopReason: "error",
          errorMessage: "assistant failed",
          content: [{ type: "text", text: "partial output" }],
        },
      }),
    ].join("\n");

    assert.deepStrictEqual(extractResponse(stdout), {
      text: "partial output",
      error: "assistant failed",
    });
  });
});

describe("createResponseCollector", () => {
  it("createResponseCollectorHandlesChunkSplitJsonlAndKeepsBoundedTails", () => {
    const collector = createResponseCollector(64);
    const splitLine = JSON.stringify({
      type: "message_end",
      message: {
        role: "assistant",
        content: [{ type: "text", text: "chunked output" }],
      },
    });

    collector.appendStdout(splitLine.slice(0, 17));
    collector.appendStdout(splitLine.slice(17) + "\n");
    collector.appendStdout("plain tail\n");
    collector.appendStderr("stderr-one");
    collector.appendStderr("-stderr-two");

    const result = collector.finalize();
    assert.deepStrictEqual(
      { text: result.text, error: result.error },
      { text: "chunked output", error: undefined },
    );
    assert.ok(result.stdoutTail.endsWith("plain tail\n"), `unexpected stdout tail: ${JSON.stringify(result.stdoutTail)}`);
    assert.ok(result.stdoutTail.length <= 64, `stdout tail grew to ${result.stdoutTail.length}`);
    assert.ok(result.stderrTail.endsWith("-stderr-two"), `unexpected stderr tail: ${JSON.stringify(result.stderrTail)}`);
    assert.ok(result.stderrTail.length <= 64, `stderr tail grew to ${result.stderrTail.length}`);
  });

  it("createResponseCollectorKeepsStdoutTailBoundedAcrossManyChunks", () => {
    const collector = createResponseCollector(32);

    for (let i = 0; i < 64; i++) {
      collector.appendStdout(`not-json-${i.toString().padStart(2, "0")}\n`);
    }

    const result = collector.finalize();
    assert.ok(result.stdoutTail.length <= 32, `stdout tail grew to ${result.stdoutTail.length}`);
  });
});
