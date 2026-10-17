import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

function readSkill(path: string): string {
  return readFileSync(path, "utf8");
}

describe("planning skill metadata", () => {
  it("planningSkillWithAutomaticInvocationControlRequiresExplicitPlanningIntent", () => {
    const planningSkill = readSkill("extension/skills/planning/SKILL.md");

    assert.match(planningSkill, /^disable-model-invocation:\s*true$/m);
    assert.match(planningSkill, /^description: Use when .*explicitly asks to plan.*\/plan/m);
    assert.doesNotMatch(planningSkill, /^description: Always use this /m);
  });
});

describe("using know-how planning gate", () => {
  it("usingKnowHowWithPlanningDecisionOnlyEntersPlanningForExplicitRequests", () => {
    const usingKnowHowSkill = readSkill("extension/skills/using-know-how/SKILL.md");

    assert.match(
      usingKnowHowSkill,
      /Did the user explicitly ask to plan or run \/plan\?/,
    );
    assert.doesNotMatch(usingKnowHowSkill, /About to enter planning flow\?/);
  });
});
