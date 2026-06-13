import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { taskSnapshot, refName } from "../extension/tools/task-snapshot";

function exec(cmd: string, cwd: string): string {
  return execSync(cmd, { cwd, encoding: "utf8" }).trim();
}

function initRepo(dir: string): void {
  exec("git init", dir);
  exec("git config user.email test@test.com", dir);
  exec("git config user.name Test", dir);
  writeFileSync(join(dir, "initial.ts"), "// initial");
  exec("git add .", dir);
  exec("git commit -m initial", dir);
}

describe("taskSnapshot", () => {
  let tmpDir: string;

  before(() => {
    tmpDir = mkdtempSync("/tmp/task-snapshot-test-");
    initRepo(tmpDir);
  });

  after(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("taskSnapshotDiff_withPriorUncommittedWork_containsOnlyTaskChanges", () => {
    // Simulate prior uncommitted work (previous task left in working tree)
    writeFileSync(join(tmpDir, "prior-work.ts"), "export const prior = true;");

    taskSnapshot("start", 42, tmpDir);

    // Current task creates a new file
    writeFileSync(join(tmpDir, "task-work.ts"), "export const task = true;");

    taskSnapshot("end", 42, tmpDir);

    const diff = taskSnapshot("diff", 42, tmpDir);

    assert.ok(diff.includes("task-work.ts"), "diff should include task-work.ts");
    assert.ok(!diff.includes("prior-work.ts"), "diff should not include prior-work.ts");
  });

  it("taskSnapshotDiff_afterCompletion_prunesBothRefs", () => {
    writeFileSync(join(tmpDir, "file-a.ts"), "export const a = 1;");
    taskSnapshot("start", 99, tmpDir);
    writeFileSync(join(tmpDir, "file-b.ts"), "export const b = 2;");
    taskSnapshot("end", 99, tmpDir);
    taskSnapshot("diff", 99, tmpDir);

    assert.throws(
      () => exec(`git rev-parse ${refName(99, "start")}`, tmpDir),
      "start ref should be deleted after diff",
    );
    assert.throws(
      () => exec(`git rev-parse ${refName(99, "end")}`, tmpDir),
      "end ref should be deleted after diff",
    );
  });

  it("taskSnapshotDiff_cleanTreeAtStart_containsTaskChanges", () => {
    const cleanDir = mkdtempSync("/tmp/task-snapshot-clean-");
    try {
      initRepo(cleanDir);

      // Working tree is clean — start snapshot should still produce a valid baseline
      taskSnapshot("start", 1, cleanDir);

      writeFileSync(join(cleanDir, "new-file.ts"), "export const x = 1;");

      taskSnapshot("end", 1, cleanDir);
      const diff = taskSnapshot("diff", 1, cleanDir);

      assert.ok(diff.includes("new-file.ts"), "diff should include new-file.ts");
    } finally {
      rmSync(cleanDir, { recursive: true, force: true });
    }
  });
});
