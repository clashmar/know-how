import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { Type } from "@sinclair/typebox";
import {
  type SubagentState,
  DISPATCH_KEY,
  createInitialState,
  type DispatchDetails,
} from "./types";
import { isInReadMode } from "./read-mode";
import { renderResultView } from "./render";
import { readSettings, type Settings } from "./settings";

/** Module-level state shared between execute and renderCall for live updates. */
let liveStates: SubagentState[] = [];

// ── Types ────────────────────────────────────────────────────────

const TaskParam = Type.Object({
  agent: Type.String(),
  task: Type.String(),
  reads: Type.Optional(Type.Array(Type.String())),
  skill: Type.Optional(Type.Union([Type.String(), Type.Array(Type.String())])),
});

const SubagentParams = Type.Object({
  cwd: Type.Optional(Type.String()),
  tasks: Type.Array(TaskParam),
  concurrency: Type.Optional(Type.Integer({ minimum: 1, default: 4 })),
});



// ── Constants ────────────────────────────────────────────────────

const KNOW_HOW_AGENTS_DIR = path.resolve(__dirname, "agents");

// ── Agent Resolution ─────────────────────────────────────────────

interface AgentModelConfig {
  model?: string;
  fallbackModels?: string[];
  thinkingLevel?: string;
}

function resolveAgentConfig(agentName: string, settings: Settings): AgentModelConfig {
  const config = settings.knowHow?.subagents?.[agentName];
  return {
    model: config?.model,
    fallbackModels: config?.fallbackModels,
    thinkingLevel: config?.thinkingLevel ?? settings.defaultThinkingLevel,
  };
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

  args.push("--mode", "json");
  args.push("-p");
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
        ...(isInReadMode() ? { PI_FORCE_READ_MODE: "1" } : {}),
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
      if (code === 0) {
        resolve(extractResponse(stdout));
      } else if (code === null) {
        reject(
          new Error(
            `Subagent "${agentName}" was killed by signal`
          )
        );
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
  // With --mode json, stdout is JSONL. Extract assistant message text.
  const parts: string[] = [];
  for (const line of stdout.split("\n")) {
    if (!line.trim()) continue;
    let evt: { type?: string; message?: { role?: string; content?: Array<{ type?: string; text?: string }> } };
    try {
      evt = JSON.parse(line.trim()) as typeof evt;
    } catch {
      continue;
    }
    if (evt.type === "message_end" && evt.message?.role === "assistant" && evt.message.content) {
      for (const part of evt.message.content) {
        if (part.type === "text" && part.text) {
          parts.push(part.text);
        }
      }
    }
  }
  return parts.join("\n").trim();
}

function buildModelList(settings: Settings, agentName?: string): string[] {
  const defaultModelId = settings.defaultProvider && settings.defaultModel
    ? `${settings.defaultProvider}/${settings.defaultModel}`
    : undefined;

  if (agentName) {
    const config = resolveAgentConfig(agentName, settings);
    const primaryModel = config.model ?? defaultModelId;
    return [
      ...(primaryModel
        ? [config.thinkingLevel ? `${primaryModel}:${config.thinkingLevel}` : primaryModel]
        : []
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
  onModelChange?: (info: { failedModel: string; error: string; nextModel?: string }) => void,
): Promise<string> {
  const settings = readSettings();
  const agentFile = resolveAgentPath(agentName);
  const agentPrompt = readAgentPrompt(agentFile);

  const models = buildModelList(settings, agentName);
  const candidates = models.length > 0 ? models : [undefined];

  let lastError: Error | undefined;

  for (let i = 0; i < candidates.length; i++) {
    const model = candidates[i];
    try {
      const { args, tempDir } = buildPiArgs({
        agentName, agentPrompt, task, reads, model,
      });
      try {
        const response = await spawnPi(agentName, args, cwd, signal, onData);
        if (!response) {
          throw new Error(`Empty response from model ${model ?? "default"}`);
        }
        return response;
      } finally {
        if (tempDir) {
          try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
        }
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const nextModel = candidates[i + 1];
      if (onModelChange) {
        onModelChange({
          failedModel: model ?? "default",
          error: lastError.message,
          nextModel,
        });
      }
    }
  }

  throw lastError || new Error(`All models failed for agent "${agentName}"`);
}

// ── Extension ────────────────────────────────────────────────────

/** Registers the subagent dispatch tool with the pi extension API. */
export default function dispatchExtension(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "subagent",
    label: "Subagent Dispatch",
    description:
      "Dispatch agents in parallel. Each agent runs with --mode json -p, " +
      "fresh context, and returns response text inline. No file writes.",
    parameters: SubagentParams,

    async execute(toolCallId, params, signal, _onUpdate, ctx) {
      const tasks = params.tasks;
      const concurrency = params.concurrency ?? 4;
      const results: string[] = [];

      const settings = readSettings();
      const states: SubagentState[] = tasks.map(t => {
        const models = buildModelList(settings, t.agent);
        return createInitialState(t.agent, models[0] ?? "unknown");
      });
      liveStates = states;

      const workDir = params.cwd ?? ctx.cwd;

      // Throttled onUpdate: push partial results to trigger renderResult re-renders
      let lastUpdate = 0;
      const UPDATE_THROTTLE_MS = 100;
      function pushUpdate() {
        const now = Date.now();
        if (now - lastUpdate < UPDATE_THROTTLE_MS) return;
        lastUpdate = now;
        _onUpdate?.({
          content: [{ type: "text" as const, text: `${states.filter(s => s.status !== "pending").length}/${states.length} agents started` }],
          details: {
            mode: "parallel" as const,
            results: states.map(s => ({ agent: s.agent, task: "", output: "" })),
            progress: states.map(s => ({ ...s })),
          },
        });
      }

      async function runTask(index: number): Promise<void> {
        const task = tasks[index]!;
        const state = states[index]!;
        const startedAt = Date.now();
        state.status = "running";
        state.lastActivityAt = startedAt;
        let lineBuffer = "";

        try {
          const response = await dispatchAgent(
            task.agent,
            task.task,
            task.reads,
            workDir,
            signal,
            (chunk: string) => {
              lineBuffer += chunk;
              const rawLines = lineBuffer.split("\n");
              lineBuffer = rawLines.pop()!;

              for (const rawLine of rawLines) {
                if (!rawLine.trim()) continue;

                let evt: { type?: string; message?: { usage?: { input?: number; output?: number } }; toolName?: string };
                try {
                  evt = JSON.parse(rawLine.trim()) as typeof evt;
                } catch {
                  continue;
                }

                // tool_execution_start
                if (evt.type === "tool_execution_start" && evt.toolName) {
                  state.toolCount++;
                  state.currentTool = evt.toolName;
                  state.currentToolArgs = undefined;
                  state.currentToolStartedAt = Date.now();
                  state.recentTools.push({
                    tool: evt.toolName,
                    args: ""
                  });
                  if (state.recentTools.length > 5) state.recentTools.shift();
                  continue;
                }

                // tool_execution_end
                if (evt.type === "tool_execution_end") {
                  state.currentTool = undefined;
                  state.currentToolArgs = undefined;
                  state.currentToolStartedAt = undefined;
                  continue;
                }

                // message_end - accumulate tokens and extract output lines
                if (evt.type === "message_end" && evt.message) {
                  const usage = evt.message.usage;
                  if (usage) {
                    state.tokens += (usage.input || 0) + (usage.output || 0);
                  }
                  // Extract text content for recent output
                  const content = (evt.message as { content?: Array<{ type?: string; text?: string }> }).content;
                  if (Array.isArray(content)) {
                    for (const part of content) {
                      if (part.type === "text" && part.text) {
                        const lines = part.text.split("\n").filter(l => l.trim());
                        for (const line of lines.slice(-5)) {
                          state.recentOutput.push(line.trim().slice(0, 120));
                          if (state.recentOutput.length > 10) state.recentOutput.shift();
                        }
                      }
                    }
                  }
                  continue;
                }
              }

              state.lastActivityAt = Date.now();
            },
            (info) => {
              state.error = `${info.failedModel}: ${info.error}`;
              lastUpdate = 0;
              pushUpdate();
              if (info.nextModel) {
                const nextModel = info.nextModel;
                setTimeout(() => {
                  state.model = nextModel;
                  state.attemptedModels.push(nextModel);
                  state.error = undefined;
                  lastUpdate = 0;
                  pushUpdate();
                }, 500);
              }
            },
          );
          state.status = "done";
          state.durationMs = Date.now() - startedAt;
          results[index] = response;
        } catch (err) {
          state.status = "failed";
          state.durationMs = Date.now() - startedAt;
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
          pushUpdate();
          await Promise.race(running);
        }
      }
      pushUpdate(); // final update
      await Promise.all(running);

      if (ctx.hasUI) {
        try { ctx.ui.setWidget(DISPATCH_KEY, undefined); } catch {}
      }

      const output = tasks
        .map((task, i) => `## ${task.agent}\n${results[i] || "(no output)"}`)
        .join("\n\n");

      return {
        content: [{ type: "text" as const, text: output }],
        details: {
          mode: "parallel" as const,
          results: tasks.map((task, i) => ({
            agent: task.agent,
            task: task.task,
            output: results[i] || "(no output)",
          })),
          progress: states.map(s => ({ ...s })),
        },
      };
    },
    renderCall(_args, theme, _context) {
      if (liveStates.length === 0) return new Text("initialising…");
      const agentList = liveStates.map(s => s.agent).join(", ");
      return new Text(
        `${theme.fg("toolTitle", theme.bold("subagent"))} dispatch (${liveStates.length}): ${theme.fg("accent", agentList)}`,
        0, 0,
      );
    },
    renderResult(result, _options, theme, context) {
      return renderResultView(
        result.details as DispatchDetails | undefined,
        theme,
        context,
      );
    },
  });
}
