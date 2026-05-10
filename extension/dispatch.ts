import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import {
  type SubagentState,
  WIDGET_KEY,
  createInitialState,
} from "./types";
import { renderWidget, stopWidgetAnimation } from "./widget";

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

interface AgentOverride {
  model?: string;
  fallbackModels?: string[];
  inheritProjectContext?: boolean;
  thinking?: string;
}

interface SubagentSettings {
  defaultProvider?: string;
  defaultModel?: string;
  subagents?: {
    agentOverrides?: Record<string, AgentOverride>;
  };
}

// ── Constants ────────────────────────────────────────────────────

const KNOW_HOW_AGENTS_DIR = path.resolve(__dirname, "agents");

// ── Agent Resolution ─────────────────────────────────────────────

interface AgentModelConfig {
  model?: string;
  fallbackModels?: string[];
  inheritProjectContext?: boolean;
  thinkingLevel?: string;
}

function resolveAgentConfig(agentName: string, raw: SubagentSettings): AgentModelConfig {
  const override = raw.subagents?.agentOverrides?.[agentName];
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

function readSettings(): SubagentSettings {
  const settingsPath = path.join(os.homedir(), ".pi", "agent", "settings.json");
  try {
    return JSON.parse(fs.readFileSync(settingsPath, "utf-8")) as SubagentSettings;
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

function buildModelList(settings: SubagentSettings, agentName?: string): string[] {
  const defaultModelId = settings?.defaultProvider && settings?.defaultModel
    ? `${settings.defaultProvider}/${settings.defaultModel}`
    : undefined;

  if (agentName) {
    const config = resolveAgentConfig(agentName, settings);
    return [
      ...(config.model
        ? [config.thinkingLevel ? `${config.model}:${config.thinkingLevel}` : config.model]
        : defaultModelId ? [defaultModelId] : []
      ),
      ...(config.fallbackModels || []),
    ];
  }

  return defaultModelId ? [defaultModelId] : [];
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

  const models = buildModelList(settings, agentName);
  const candidates = models.length > 0 ? models : [undefined];

  let lastError: Error | undefined;

  for (const model of candidates) {
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

// ── Extension ────────────────────────────────────────────────────

export default function dispatchExtension(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "subagent",
    label: "Subagent Dispatch",
    description:
      "Dispatch agents in parallel. Each agent runs with --print --no-session, " +
      "fresh context, and returns response text inline. No file writes.",
    parameters: SubagentParams,

    async execute(toolCallId, params, signal, _onUpdate, ctx) {
      const tasks = params.tasks;
      const concurrency = params.concurrency ?? 4;
      const results: string[] = [];

      const firstModel = buildModelList(readSettings())[0] ?? "unknown";
      const states: SubagentState[] = tasks.map(t =>
        createInitialState(t.agent, firstModel)
      );

      renderWidget(ctx, states);

      async function runTask(index: number): Promise<void> {
        const task = tasks[index]!;
        const state = states[index]!;
        state.status = "running";
        state.lastActivityAt = Date.now();

        try {
          const response = await dispatchAgent(
            task.agent,
            task.task,
            task.reads,
            ctx.cwd,
            signal,
            (chunk: string) => {
              const clean = chunk.replace(/\x1b\[[0-9;]*m/g, "");

              const toolMatch = clean.match(/(?:Tool|tool):\s*(\S+)/);
              if (toolMatch) {
                state.toolCount++;
                state.currentTool = toolMatch[1]!;
                state.currentToolStartedAt = Date.now();
                state.recentTools.push({
                  tool: toolMatch[1]!,
                  args: clean.trim().slice(0, 100)
                });
                if (state.recentTools.length > 5) state.recentTools.shift();
              }

              const lines = clean.split("\n").filter(l => l.trim());
              for (const line of lines) {
                state.recentOutput.push(line.trim().slice(0, 120));
                if (state.recentOutput.length > 10) state.recentOutput.shift();
              }

              state.lastActivityAt = Date.now();
            },
          );
          state.status = "done";
          state.durationMs = Date.now() - (state.lastActivityAt ?? Date.now());
          results[index] = response;
        } catch (err) {
          state.status = "failed";
          state.durationMs = Date.now() - (state.lastActivityAt ?? Date.now());
          state.error = err instanceof Error ? err.message : String(err);
          results[index] = `Error: ${state.error}`;
        }
      }

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

      stopWidgetAnimation();
      if (ctx.hasUI) {
        try { ctx.ui.setWidget(WIDGET_KEY, undefined); } catch {}
      }

      const output = tasks
        .map((task, i) => `## ${task.agent}\n${results[i] || "(no output)"}`)
        .join("\n\n");

      return {
        content: [{ type: "text" as const, text: output }],
      };
    },
  });
}
