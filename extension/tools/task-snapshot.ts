import { execSync } from "node:child_process";
import { Type } from "@sinclair/typebox";
import { Text } from "@earendil-works/pi-tui";
// @mariozechner/pi-coding-agent is deprecated upstream; will migrate when @samfp/pi-memory updates
import type { ExtensionAPI, AgentToolResult } from "@mariozechner/pi-coding-agent";

const REF_NS = "refs/snapshots";

/**
 * Captures, retrieves, and prunes git working-tree snapshots at task boundaries.
 * Exported for testing — registration wrapper is registerTaskSnapshot.
 */
export function taskSnapshot(action: "start" | "end" | "diff", taskId: number, cwd = process.cwd()): string {
  switch (action) {
    case "start":
      return captureSnapshot(taskId, "start", cwd);
    case "end":
      return captureSnapshot(taskId, "end", cwd);
    case "diff": {
      const startRef = refName(taskId, "start");
      const endRef = refName(taskId, "end");
      let startSha: string;
      let endSha: string;
      try {
        startSha = run(`git rev-parse ${startRef}`, cwd);
        endSha = run(`git rev-parse ${endRef}`, cwd);
      } catch {
        throw new Error(
          `Snapshot refs not found for task ${taskId}. Call task_snapshot with action "start" before the task and "end" after verification passes.`
        );
      }
      const diff = execSync(`git diff ${startSha} ${endSha}`, { cwd, encoding: "utf8" });
      run(`git update-ref -d ${startRef}`, cwd);
      run(`git update-ref -d ${endRef}`, cwd);
      run("git gc --auto", cwd);
      return diff;
    }
  }
}

/** Registers the task_snapshot tool with the pi agent. */
export function registerTaskSnapshot(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "task_snapshot",
    label: "Task Snapshot",
    description:
      "Captures a git working-tree snapshot at a task boundary and stores it as a named git ref. " +
      "Call with action 'start' immediately after marking a task in_progress, 'end' after verification " +
      "passes, and 'diff' to get a task-scoped diff. The 'diff' action returns the diff text and " +
      "automatically prunes the snapshot refs and runs git gc --auto.",
    parameters: Type.Object({
      action: Type.Union(
        [Type.Literal("start"), Type.Literal("end"), Type.Literal("diff")],
        {
          description:
            "start: capture baseline before task work; " +
            "end: capture post-task state after verification; " +
            "diff: return task-scoped diff text and prune refs",
        }
      ),
      taskId: Type.Number({
        description: "The todo task ID to associate with this snapshot",
      }),
    }),
    renderCall(args, theme) {
      // Construct plain label first; both action and taskId are short by definition
      const action = String(args.action).slice(0, 10);
      const id = String(args.taskId).slice(0, 8);
      return new Text(
        `${theme.fg("toolTitle", theme.bold("task snapshot"))} ${theme.fg("dim", "·")} ${theme.fg("accent", action)} ${theme.fg("dim", `task ${id}`)}`,
        0, 0,
      );
    },
    async execute(_toolCallId, params, _signal, _onUpdate, ctx): Promise<AgentToolResult<unknown>> {
      try {
        const cwd = ctx.cwd ?? process.cwd();
        const result = taskSnapshot(params.action, params.taskId, cwd);
        return {
          content: [{ type: "text" as const, text: result }],
          details: {},
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text" as const, text: `Error: ${message}` }],
          details: {},
        };
      }
    },
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns the git ref name for a snapshot. Exported for use in tests. */
export function refName(taskId: number, suffix: "start" | "end"): string {
  return `${REF_NS}/task-${taskId}-${suffix}`;
}

function run(cmd: string, cwd: string): string {
  return execSync(cmd, { cwd, encoding: "utf8" }).trim();
}

function captureSnapshot(taskId: number, suffix: "start" | "end", cwd: string): string {
  // Save current index so it can be restored even if snapshot creation fails
  const savedIndex = run("git write-tree", cwd);
  try {
    // Stage all working tree changes including untracked new files
    run("git add -A", cwd);

    // Capture the full working-tree state as a tree object
    const snapshotTree = run("git write-tree", cwd);

    // Create a commit object from the snapshot tree so git diff works naturally
    const head = run("git rev-parse HEAD", cwd);
    const sha = run(`git commit-tree -p ${head} -m "task-snapshot" ${snapshotTree}`, cwd);

    run(`git update-ref ${refName(taskId, suffix)} ${sha}`, cwd);
    return `Snapshot ${suffix} stored for task ${taskId} (${sha.slice(0, 7)})`;
  } finally {
    // Restore original index — does not touch the working tree
    run(`git read-tree ${savedIndex}`, cwd);
  }
}
