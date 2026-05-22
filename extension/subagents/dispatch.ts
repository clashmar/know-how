import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent"; 
// @mariozechner/pi-coding-agent is deprecated upstream; will migrate when @samfp/pi-memory updates
import { Text } from "@earendil-works/pi-tui";
import { Type } from "@sinclair/typebox";
import {
  type SubagentState,
  createInitialState,
  type DispatchDetails,
} from "./types";
import { isInReadMode, isRoleLocked, isWriteCapableRole, requestWriteMode } from "../write-mode/read-mode";
import type { WriteModeApprovalRequest } from "../write-mode/approval";
import { renderResultView } from "./render";
import { createResponseCollector } from "./response-collector";
import { readSettings, type Settings } from "../settings";

// ── Types ────────────────────────────────────────────────────────

const SubagentParams = Type.Object({
  agent: Type.String({ description: "Name of the agent to invoke" }),
  task: Type.String({ description: "Task to delegate to the agent" }),
  reads: Type.Optional(Type.Array(Type.String())),
  cwd: Type.Optional(Type.String({ description: "Working directory for the agent process" })),
});

// ── Constants ────────────────────────────────────────────────────

const KNOW_HOW_AGENTS_DIR = path.resolve(__dirname, "..", "agents");
const TOOL_PREVIEW_LIMIT = 240;

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function getStringArg(args: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = args[key];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }
  return undefined;
}

function getNumberArg(args: Record<string, unknown>, key: string): number | undefined {
  const value = args[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function shortenPath(inputPath: string): string {
  const home = os.homedir();
  return inputPath.startsWith(home) ? `~${inputPath.slice(home.length)}` : inputPath;
}

function previewText(text: string, limit: number = TOOL_PREVIEW_LIMIT): string {
  return text.length <= limit ? text : `${text.slice(0, limit - 1)}…`;
}

function formatToolCommand(toolName: string, args: Record<string, unknown>): string {
  switch (toolName) {
    case "bash": {
      const command = getStringArg(args, "command") ?? "...";
      return `$ ${previewText(command)}`;
    }
    case "read": {
      const filePath = shortenPath(getStringArg(args, "file_path", "path") ?? "...");
      const offset = getNumberArg(args, "offset");
      const limit = getNumberArg(args, "limit");
      if (offset !== undefined || limit !== undefined) {
        const startLine = offset ?? 1;
        const endLine = limit !== undefined ? startLine + limit - 1 : undefined;
        return `read ${filePath}:${startLine}${endLine !== undefined ? `-${endLine}` : ""}`;
      }
      return `read ${filePath}`;
    }
    case "write":
      return `write ${shortenPath(getStringArg(args, "file_path", "path") ?? "...")}`;
    case "edit":
      return `edit ${shortenPath(getStringArg(args, "file_path", "path") ?? "...")}`;
    case "ls":
      return `ls ${shortenPath(getStringArg(args, "path") ?? ".")}`;
    case "find": {
      const pattern = getStringArg(args, "pattern") ?? "*";
      const filePath = shortenPath(getStringArg(args, "path") ?? ".");
      return `find ${pattern} in ${filePath}`;
    }
    case "grep": {
      const pattern = getStringArg(args, "pattern") ?? "";
      const filePath = shortenPath(getStringArg(args, "path") ?? ".");
      return `grep /${pattern}/ in ${filePath}`;
    }
    default: {
      const argsPreview = previewText(JSON.stringify(args) ?? "{}");
      return argsPreview ? `${toolName} ${argsPreview}` : toolName;
    }
  }
}

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
  const khPath = path.join(KNOW_HOW_AGENTS_DIR, `${agentName}.md`);
  if (fs.existsSync(khPath)) return khPath;

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

  let taskText = params.task;
  if (params.reads?.length) {
    taskText = `[Read from: ${params.reads.join(", ")}]\n\n${params.task}`;
  }

  args.push("--mode", "json");
  args.push("-p");
  args.push("--no-session");

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

    const responseCollector = createResponseCollector();

    child.stdout?.on("data", (data: Buffer) => {
      const chunk = data.toString();
      responseCollector.appendStdout(chunk);
      if (onData) onData(chunk);
    });
    child.stderr?.on("data", (data: Buffer) => {
      responseCollector.appendStderr(data.toString());
    });

    child.stdin?.end();

    child.on("close", (code) => {
      const extracted = responseCollector.finalize();
      if (code === 0) {
        if (extracted.error && !extracted.text) {
          reject(new Error(extracted.error));
          return;
        }
        resolve(extracted.text);
      } else if (code === null) {
        reject(new Error(`Subagent "${agentName}" was killed by signal`));
      } else {
        const details = [
          extracted.error,
          extracted.stderrTail.trim() || undefined,
          !extracted.stderrTail.trim() ? extracted.stdoutTail.trim() || undefined : undefined,
        ].filter((value): value is string => Boolean(value));
        reject(new Error(
          `Subagent "${agentName}" exited with code ${code}${details.length > 0 ? `\n${details.join("\n")}` : ""}`
        ));
      }
    });

    child.on("error", (err) => {
      reject(new Error(`Failed to spawn pi for "${agentName}": ${err.message}`));
    });

    if (signal && typeof signal.addEventListener === "function") {
      const onAbort = () => { child.kill("SIGKILL"); signal.removeEventListener("abort", onAbort); };
      signal.addEventListener("abort", onAbort, { once: true });
    }
  });
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

interface ModelAttemptFailure {
  model: string;
  error: string;
}

function shouldRetryWithFallback(error: Error): boolean {
  return !error.message.startsWith("Empty response from model ");
}

function formatAttemptFailures(agentName: string, failures: ModelAttemptFailure[]): Error {
  if (failures.length === 0) {
    return new Error(`All models failed for agent "${agentName}"`);
  }
  const summary = failures.map(({ model, error }) => `- ${model}: ${error}`).join("\n");
  return new Error(`All models failed for agent "${agentName}"\nAttempted models:\n${summary}`);
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
  const failures: ModelAttemptFailure[] = [];

  for (let i = 0; i < candidates.length; i++) {
    const model = candidates[i] ?? "default";
    try {
      const { args, tempDir } = buildPiArgs({
        agentName, agentPrompt, task, reads, model: candidates[i],
      });
      try {
        const response = await spawnPi(agentName, args, cwd, signal, onData);
        if (!response) {
          throw new Error(`Empty response from model ${model}`);
        }
        return response;
      } finally {
        if (tempDir) {
          try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
        }
      }
    } catch (error) {
      const attemptError = error instanceof Error ? error : new Error(String(error));
      failures.push({ model, error: attemptError.message });
      // Don't try fallback models if the user cancelled (Escape).
      // Exception: if the child was signal-killed, the AbortSignal may have been
      // set by a pi timeout rather than the user pressing Escape — still retry.
      const isSignalKill = attemptError.message.includes("was killed by signal");
      if (signal?.aborted && !isSignalKill) break;
      const nextModel = shouldRetryWithFallback(attemptError) ? candidates[i + 1] : undefined;
      if (onModelChange) {
        onModelChange({ failedModel: model, error: attemptError.message, nextModel });
      }
      if (!nextModel) break;
    }
  }

  throw formatAttemptFailures(agentName, failures);
}

// ── Extension ────────────────────────────────────────────────────

export default function dispatchExtension(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "subagent",
    label: "Subagent Dispatch",
    description:
      "Dispatch an agent with --mode json -p, fresh context. " +
      "Use multiple calls for parallel agents — each call gets its own progress block in the feed.",
    parameters: SubagentParams,

    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const agentName = params.agent;
      const task = params.task;
      const reads = params.reads;
      const workDir = params.cwd ?? ctx.cwd;

      const settings = readSettings();
      const models = buildModelList(settings, agentName);
      const state = createInitialState(agentName, models[0] ?? "unknown");
      const dispatchStartedAt = Date.now();
      const startedAt = Date.now();
      state.status = "running";
      state.lastActivityAt = startedAt;

      // ── Write-mode gate ────────────────────────────────────────
      if (isInReadMode() && isWriteCapableRole(agentName)) {
        if (isRoleLocked()) {
          return {
            content: [{ type: "text" as const, text: `## ${agentName}\nError: Write-capable agent blocked — parent role is locked to read-only.` }],
            details: {},
          };
        }
        if (!ctx.hasUI) {
          return {
            content: [{ type: "text" as const, text: `## ${agentName}\nPaused: Write-capable agent requires write access, but subagent dispatch has no interactive UI.` }],
            details: {},
          };
        }
        const result = await requestWriteMode(ctx, {
          title: "Subagent dispatch needs write access",
          actionLabel: "Switch to write mode",
          reason: `Write-capable agent: ${agentName}`,
        });
        if (result !== "enabled" && result !== "already-write") {
          const reasonMsg = result === "declined" ? "Write mode declined by user."
            : result === "deferred" ? "Write mode deferred by user."
            : "Write mode blocked.";
          return {
            content: [{ type: "text" as const, text: `## ${agentName}\nSkipped: ${reasonMsg}` }],
            details: {},
          };
        }
      }

      // Throttled pushUpdate for live renderResult re-renders
      let lastUpdate = 0;
      const UPDATE_THROTTLE_MS = 100;
      function pushUpdate() {
        const now = Date.now();
        if (now - lastUpdate < UPDATE_THROTTLE_MS) return;
        lastUpdate = now;
        const details: DispatchDetails = {
          results: [{ agent: agentName, task, output: "" }],
          progress: state,
          dispatchStartedAt,
        };
        _onUpdate?.({ content: [{ type: "text" as const, text: `${agentName} — running` }], details });
      }

      let lineBuffer = "";
      let response: string;

      try {
        response = await dispatchAgent(
          agentName, task, reads, workDir, signal,
          (chunk: string) => {
            lineBuffer += chunk;
            const rawLines = lineBuffer.split("\n");
            lineBuffer = rawLines.pop()!;

            for (const rawLine of rawLines) {
              if (!rawLine.trim()) continue;
              let evt: { type?: string; message?: { usage?: { input?: number; output?: number }; content?: Array<{ type?: string; text?: string }> }; toolName?: string; args?: unknown };
              try { evt = JSON.parse(rawLine.trim()) as typeof evt; } catch { continue; }

              if (evt.type === "tool_execution_start" && evt.toolName) {
                const commandText = formatToolCommand(evt.toolName, asRecord(evt.args));
                state.toolCount++;
                state.currentTool = evt.toolName;
                state.currentToolArgs = commandText;
                state.currentToolStartedAt = Date.now();
                state.recentTools.push({ tool: evt.toolName, args: commandText });
                if (state.recentTools.length > 5) state.recentTools.shift();
                continue;
              }

              if (evt.type === "tool_execution_end") {
                state.currentTool = undefined;
                state.currentToolArgs = undefined;
                state.currentToolStartedAt = undefined;
                continue;
              }

              if (evt.type === "message_end" && evt.message) {
                const usage = evt.message.usage;
                if (usage) state.tokens += (usage.input || 0) + (usage.output || 0);
                state.turnCount++;
                const content = evt.message.content;
                if (Array.isArray(content)) {
                  for (const part of content) {
                    if (part.type === "text" && part.text) {
                      const lines = part.text.split("\n").filter(l => l.trim());
                      for (const line of lines.slice(-10)) {
                        state.recentOutput.push(line.trim().slice(0, 200));
                        if (state.recentOutput.length > 50) state.recentOutput.shift();
                      }
                    }
                  }
                }
                continue;
              }
            }
            state.lastActivityAt = Date.now();
            pushUpdate();
          },
          (info) => {
            state.error = `${info.failedModel}: ${info.error}`;
            state.lastActivityAt = Date.now();
            if (info.nextModel) {
              state.model = info.nextModel;
              if (!state.attemptedModels.includes(info.nextModel)) state.attemptedModels.push(info.nextModel);
            }
            pushUpdate();
          },
        );
        state.status = "done";
        state.durationMs = Date.now() - startedAt;
      } catch (err) {
        state.status = "failed";
        state.durationMs = Date.now() - startedAt;
        state.error = err instanceof Error ? err.message : String(err);
        response = `Error: ${state.error}`;
      }

      pushUpdate();

      if (ctx.hasUI) {
      }

      const details: DispatchDetails = {
        results: [{ agent: agentName, task, output: response }],
        progress: state,
        dispatchStartedAt,
      };

      return {
        content: [{ type: "text" as const, text: `## ${agentName}\n${response}` }],
        details,
      };
    },

    renderCall(_args, theme, _context) {
      return new Text(
        `${theme.fg("toolTitle", theme.bold("subagent"))}: ${theme.fg("accent", _args.agent ?? "…")}`,
        0, 0,
      );
    },

    renderResult(result, _options, theme, context) {
      return renderResultView(result.details as DispatchDetails | undefined, theme, context);
    },
  });
}
