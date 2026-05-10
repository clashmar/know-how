import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type, type Static } from "@sinclair/typebox";

// ── Types ────────────────────────────────────────────────────────

const TaskParam = Type.Object({
  agent: Type.String(),
  task: Type.String(),
  reads: Type.Optional(Type.Array(Type.String())),
  skill: Type.Optional(Type.Union([Type.String(), Type.Array(Type.String())])),
});

const SubagentParams = Type.Object({
  tasks: Type.Array(TaskParam),
  concurrency: Type.Optional(Type.Integer({ minimum: 1, default: 4 })),
});

type SubagentInput = Static<typeof SubagentParams>;

interface SubagentStatus {
  agent: string;
  status: "pending" | "running" | "done" | "failed";
  line?: string;
  durationMs?: number;
  error?: string;
}

// ── Constants ────────────────────────────────────────────────────

const KNOW_HOW_AGENTS_DIR = path.resolve(__dirname, "agents");
const WIDGET_KEY = "subagent-dispatch";
const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

// ── Agent Resolution ─────────────────────────────────────────────

interface AgentModelConfig {
  model?: string;
  fallbackModels?: string[];
  inheritProjectContext?: boolean;
  thinkingLevel?: string;
}

function resolveAgentConfig(agentName: string, settings: any): AgentModelConfig {
  // Per-agent override from subagents.agentOverrides
  const override = settings?.subagents?.agentOverrides?.[agentName];
  if (override) {
    return {
      model: override.model?.toString(),
      fallbackModels: Array.isArray(override.fallbackModels)
        ? override.fallbackModels.map(String)
        : undefined,
      inheritProjectContext: override.inheritProjectContext !== undefined
        ? override.inheritProjectContext === true
        : undefined,
      thinkingLevel: override.thinking?.toString(),
    };
  }
  return {};
}

function readSettings(): any {
  const settingsPath = path.join(os.homedir(), ".pi", "agent", "settings.json");
  try {
    return JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
  } catch {
    return {};
  }
}

function resolveAgentPath(agentName: string): string {
  // Try know-how agents first
  const khPath = path.join(KNOW_HOW_AGENTS_DIR, `${agentName}.md`);
  if (fs.existsSync(khPath)) return khPath;

  // Fall back to pi's agent directory (for user-defined agents)
  const piAgentPath = path.join(
    os.homedir(), ".pi", "agent", "agents", `${agentName}.md`
  );
  if (fs.existsSync(piAgentPath)) return piAgentPath;

  throw new Error(
    `Agent "${agentName}" not found in ${KNOW_HOW_AGENTS_DIR} or ~/.pi/agent/agents/`
  );
}

function readAgentPrompt(filePath: string): string {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    // Strip YAML frontmatter (--- ... ---) and return body
    const match = content.match(/^---\n[\s\S]*?\n---\n?([\s\S]*)$/);
    return match ? match[1].trim() : content.trim();
  } catch {
    return "";
  }
}

function buildPiArgs(params: {
  agentName: string;
  agentPrompt: string;
  task: string;
  reads?: string[];
  model?: string;
}): { args: string[]; tempDir?: string } {
  const args: string[] = [];

  // Task text: prepend reads if provided
  let taskText = params.task;
  if (params.reads?.length) {
    taskText = `[Read from: ${params.reads.join(", ")}]\n\n${taskText}`;
  }

  args.push("--print");
  args.push("--no-session");

  // Write system prompt to temp file, pass file path (matching pi-subagents approach)
  let tempDir: string | undefined;
  if (params.agentPrompt) {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "kh-subagent-"));
    const promptPath = path.join(tempDir, "prompt.md");
    fs.writeFileSync(promptPath, params.agentPrompt, "utf-8");
    args.push("--system-prompt", promptPath);
  }

  if (params.model) {
    args.push("--model", params.model);
  }

  // Task as positional arg
  args.push(taskText);

  return { args, tempDir };
}

// ── Process Spawning ────────────────────────────────────────────

function spawnPi(
  agentName: string,
  args: string[],
  cwd: string,
  signal?: AbortSignal,
  onData?: (chunk: string) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("pi", args, {
      cwd,
      env: {
        ...process.env,
        PI_SUBAGENT_CHILD: "1",
        PI_SUBAGENT_CHILD_AGENT: agentName,
      },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (data: Buffer) => {
      const chunk = data.toString();
      stdout += chunk;
      if (onData) onData(chunk);
    });
    child.stderr?.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    // Close stdin — pi may block reading from an open pipe
    child.stdin?.end();

    child.on("close", (code) => {
      if (code === 0 || code === null) {
        resolve(extractResponse(stdout));
      } else {
        reject(
          new Error(
            `Subagent "${agentName}" exited with code ${code}\nStderr: ${stderr.slice(-1000)}`
          )
        );
      }
    });

    child.on("error", (err) => {
      reject(new Error(`Failed to spawn pi for "${agentName}": ${err.message}`));
    });

    if (signal && typeof signal.addEventListener === "function") {
      const onAbort = () => { child.kill(); signal.removeEventListener("abort", onAbort); };
      signal.addEventListener("abort", onAbort, { once: true });
    }
  });
}

function extractResponse(stdout: string): string {
  // Strip ANSI escape codes
  let text = stdout.replace(/\x1b\[[0-9;]*m/g, "");
  // Remove trailing whitespace
  text = text.trim();
  return text;
}

async function dispatchAgent(
  agentName: string,
  task: string,
  reads: string[] | undefined,
  cwd: string,
  signal?: AbortSignal,
  onData?: (chunk: string) => void,
): Promise<string> {
  const settings = readSettings();
  const agentFile = resolveAgentPath(agentName);
  const config = resolveAgentConfig(agentName, settings);
  const agentPrompt = readAgentPrompt(agentFile);

  // Build model list: per-agent override → top-level defaultModel → hardcoded fallback
  const defaultModelId = settings?.defaultProvider && settings?.defaultModel
    ? `${settings.defaultProvider}/${settings.defaultModel}`
    : settings?.defaultModel
    ? settings.defaultModel
    : undefined;

  const models = [
    ...(config.model
      ? [config.thinkingLevel ? `${config.model}:${config.thinkingLevel}` : config.model]
      : defaultModelId ? [defaultModelId] : ["google/gemini-3-flash"]
    ),
    ...(config.fallbackModels || []),
  ];

  let lastError: Error | undefined;

  for (const model of models) {
    try {
      const { args, tempDir } = buildPiArgs({
        agentName, agentPrompt, task, reads, model,
      });
      try {
        return await spawnPi(agentName, args, cwd, signal, onData);
      } finally {
        if (tempDir) {
          try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
        }
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError || new Error(`All models failed for agent "${agentName}"`);
}

// ── Helper Functions for TUI ────────────────────────────────────

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

function renderWidget(statuses: SubagentStatus[]): string[] {
  const frame = Math.floor(Date.now() / 100) % SPINNER.length;
  const lines: string[] = [];
  for (const s of statuses) {
    let line: string;
    switch (s.status) {
      case "pending":
        line = `⠿ ${s.agent} · waiting...`;
        break;
      case "running":
        line = `${SPINNER[frame]} ${s.agent}${s.line ? ` · ${s.line}` : ""}`;
        break;
      case "done":
        line = `✓ ${s.agent} (done, ${formatDuration(s.durationMs || 0)})`;
        break;
      case "failed":
        line = `✗ ${s.agent} (failed${s.error ? `: ${s.error.slice(0, 80)}` : ""})`;
        break;
    }
    lines.push(line);
  }
  return lines;
}

// ── Extension ────────────────────────────────────────────────────

export default function dispatchExtension(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "subagent",
    label: "Subagent Dispatch",
    description:
      "Dispatch agents in parallel. Each agent runs with --print --no-session, " +
      "fresh context, and returns response text inline. No file writes.",
    parameters: SubagentParams,

    async execute(toolCallId, params, signal, onUpdate, ctx) {
      const tasks = params.tasks;
      const concurrency = params.concurrency ?? 4;
      const results: string[] = [];
      const statuses: SubagentStatus[] = tasks.map((t) => ({
        agent: t.agent,
        status: "pending" as const,
      }));

      // Widget renderer
      let widgetInterval: ReturnType<typeof setInterval> | undefined;
      if (ctx.hasUI) {
        widgetInterval = setInterval(() => {
          try {
            ctx.ui.setWidget(WIDGET_KEY, () => ({
              render: () => renderWidget(statuses),
              invalidate: () => {},
            }));
          } catch {
            // Widget may fail if context is stale
          }
        }, 100);
      }

      // Run each task
      async function runTask(index: number): Promise<void> {
        const task = tasks[index]!;
        const status = statuses[index]!;
        status.status = "running";
        const startTime = Date.now();
        try {
          const response = await dispatchAgent(
            task.agent,
            task.task,
            task.reads,
            ctx.cwd,
            signal,
            (chunk: string) => {
              // Show latest meaningful line in the widget
              const clean = chunk.replace(/\x1b\[[0-9;]*m/g, "").trim();
              if (clean) {
                // Take first line, truncate to fit terminal — pi-tui crashes on oversize lines
                status.line = clean.split("\n")[0]!.slice(0, 50);
              }
            },
          );
          status.status = "done";
          status.durationMs = Date.now() - startTime;
          results[index] = response;
        } catch (error) {
          status.status = "failed";
          status.durationMs = Date.now() - startTime;
          status.error = error instanceof Error ? error.message : String(error);
          results[index] = `Error: ${status.error}`;
        }
      }

      // Concurrent execution
      let nextIndex = 0;
      const running = new Set<Promise<void>>();

      while (nextIndex < tasks.length || running.size > 0) {
        while (nextIndex < tasks.length && running.size < concurrency) {
          const p = runTask(nextIndex++);
          running.add(p);
          p.finally(() => running.delete(p));
        }
        if (running.size > 0) {
          await Promise.race(running);
        }
      }

      await Promise.all(running);

      // Clear widget
      if (widgetInterval) {
        clearInterval(widgetInterval);
        try {
          ctx.ui.setWidget(WIDGET_KEY, undefined);
        } catch {
          // Ignore stale context errors
        }
      }

      // Format output
      const output = tasks
        .map((task, i) => `## ${task.agent}\n${results[i] || "(no output)"}`)
        .join("\n\n");

      return {
        content: [{ type: "text" as const, text: output }],
      };
    },
  });
}
