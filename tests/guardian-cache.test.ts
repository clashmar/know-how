import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import {
  clearGuardianDispatchCache,
  prepareGuardianDispatch,
  rememberGuardianDispatch,
} from "../extension/subagents/guardian-cache";

interface TestPaths {
  homeDir: string;
  repoDir: string;
  filePath: string;
  projectSkillPath: string;
}

function run(cmd: string, cwd: string): string {
  return execSync(cmd, { cwd, encoding: "utf8" }).trim();
}

function setupGuardianFixture(): TestPaths {
  const rootDir = mkdtempSync(path.join(os.tmpdir(), "guardian-cache-"));
  const homeDir = path.join(rootDir, "home");
  const repoDir = path.join(rootDir, "repo");
  const projectName = path.basename(repoDir).toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const globalAgentsPath = path.join(homeDir, ".pi", "agent", "AGENTS.md");
  const projectSkillPath = path.join(homeDir, ".pi", "agent", "skills", projectName, "SKILL.md");
  const repoAgentsPath = path.join(repoDir, "AGENTS.md");
  const filePath = path.join(repoDir, "src", "feature.ts");

  mkdirSync(path.dirname(globalAgentsPath), { recursive: true });
  mkdirSync(path.dirname(projectSkillPath), { recursive: true });
  mkdirSync(path.dirname(filePath), { recursive: true });

  writeFileSync(globalAgentsPath, "# Global Rules\n- no cosmetic changes\n");
  writeFileSync(projectSkillPath, "---\nname: repo\ndescription: Use when testing\n---\n# Project Skill\n- keep tests focused\n");
  writeFileSync(repoAgentsPath, "# Repo Rules\n- keep diffs narrow\n");
  writeFileSync(filePath, "export const feature = true;\n");

  run("git init", repoDir);
  run("git config user.email test@example.com", repoDir);
  run("git config user.name Test", repoDir);

  return { homeDir, repoDir, filePath, projectSkillPath };
}

function buildGuardianTask(repoDir: string): string {
  return [
    "WHAT_WAS_IMPLEMENTED: add feature guard",
    "PLAN_OR_REQUIREMENTS: Task 1 from /tmp/plan.md",
    "DIFF: diff --git a/src/feature.ts b/src/feature.ts",
    "index 1111111..2222222 100644",
    "--- a/src/feature.ts",
    "+++ b/src/feature.ts",
    "@@ -1 +1,2 @@",
    "+export const guard = true;",
    " WORK_FROM: " + repoDir,
    "DESCRIPTION: add feature guard",
  ].join("\n");
}

describe("prepareGuardianDispatch", () => {
  it("prepareGuardianDispatch_withGuardianRequestPrependsConventionBundleAndReturnsCachedHit", () => {
    clearGuardianDispatchCache();
    const fixture = setupGuardianFixture();

    try {
      const initial = prepareGuardianDispatch(
        {
          agentName: "guardian",
          task: buildGuardianTask(fixture.repoDir),
          cwd: fixture.repoDir,
          promptText: "guardian prompt",
          modelSignature: "model-a|model-b",
        },
        { homeDir: fixture.homeDir },
      );

      assert.match(initial.task, /<guardian-conventions-bundle>/);
      assert.match(initial.task, /# Global Rules/);
      assert.match(initial.task, /# Repo Rules/);
      assert.match(initial.task, /# Project Skill/);
      assert.ok(initial.cacheKey);
      assert.strictEqual(initial.cachedResponse, undefined);

      rememberGuardianDispatch(initial.cacheKey ?? null, "No findings.");

      const repeated = prepareGuardianDispatch(
        {
          agentName: "guardian",
          task: buildGuardianTask(fixture.repoDir),
          cwd: fixture.repoDir,
          promptText: "guardian prompt",
          modelSignature: "model-a|model-b",
        },
        { homeDir: fixture.homeDir },
      );

      assert.strictEqual(repeated.cacheKey, initial.cacheKey);
      assert.strictEqual(repeated.cachedResponse, "No findings.");
    } finally {
      rmSync(path.dirname(fixture.homeDir), { recursive: true, force: true });
      clearGuardianDispatchCache();
    }
  });

  it("prepareGuardianDispatch_withTouchedFileChangeInvalidatesCachedResponse", () => {
    clearGuardianDispatchCache();
    const fixture = setupGuardianFixture();

    try {
      const initial = prepareGuardianDispatch(
        {
          agentName: "guardian",
          task: buildGuardianTask(fixture.repoDir),
          cwd: fixture.repoDir,
          promptText: "guardian prompt",
          modelSignature: "model-a|model-b",
        },
        { homeDir: fixture.homeDir },
      );

      rememberGuardianDispatch(initial.cacheKey ?? null, "No findings.");
      writeFileSync(fixture.filePath, "export const feature = false;\n");

      const afterChange = prepareGuardianDispatch(
        {
          agentName: "guardian",
          task: buildGuardianTask(fixture.repoDir),
          cwd: fixture.repoDir,
          promptText: "guardian prompt",
          modelSignature: "model-a|model-b",
        },
        { homeDir: fixture.homeDir },
      );

      assert.notStrictEqual(afterChange.cacheKey, initial.cacheKey);
      assert.strictEqual(afterChange.cachedResponse, undefined);
    } finally {
      rmSync(path.dirname(fixture.homeDir), { recursive: true, force: true });
      clearGuardianDispatchCache();
    }
  });

  it("prepareGuardianDispatch_withNonGuardianAgentLeavesTaskUnchanged", () => {
    clearGuardianDispatchCache();
    const task = "Review these files";

    const result = prepareGuardianDispatch({
      agentName: "scout",
      task,
      cwd: "/tmp",
      promptText: "scout prompt",
      modelSignature: "model-a",
    });

    assert.strictEqual(result.task, task);
    assert.strictEqual(result.cacheKey, null);
    assert.strictEqual(result.cachedResponse, undefined);
  });
});
