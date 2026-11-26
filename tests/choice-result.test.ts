import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FREE_TEXT_REPLY_PREFIX,
  formatChoiceReply,
  formatDecisionLines,
} from "../extension/tools/choice-result";

describe("formatChoiceReply", () => {
  it("formatChoiceReplyListedOptionReturnsValueUnchanged", () => {
    assert.strictEqual(formatChoiceReply("A", false), "A");
  });

  it("formatChoiceReplyFreeTextReturnsMarkedReplyWithTextVerbatim", () => {
    const typed = 'Would it work? "yes"\nand more';

    assert.strictEqual(formatChoiceReply(typed, true), `${FREE_TEXT_REPLY_PREFIX}"${typed}"`);
  });

  it("formatChoiceReplyEmptyFreeTextReturnsMarkedEmptyReply", () => {
    assert.strictEqual(formatChoiceReply("", true), `${FREE_TEXT_REPLY_PREFIX}""`);
  });
});

describe("formatDecisionLines", () => {
  it("formatDecisionLinesMarksOnlyFreeTextDecisions", () => {
    const values = { Worktree: "Direct", Autonomy: "something custom" };

    assert.deepStrictEqual(formatDecisionLines(values, new Set(["Autonomy"])), [
      "- Worktree: Direct",
      `- Autonomy: ${FREE_TEXT_REPLY_PREFIX}"something custom"`,
    ]);
  });

  it("formatDecisionLinesUnansweredOtherDecisionStaysEmptyAndUnmarked", () => {
    assert.deepStrictEqual(formatDecisionLines({ Autonomy: "" }, new Set()), ["- Autonomy: "]);
  });
});
