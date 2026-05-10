// extension/types.ts

export type SubagentStatus = "pending" | "running" | "done" | "failed";

export interface SubagentState {
  agent: string;
  status: SubagentStatus;
  
  // Model info
  model: string;
  attemptedModels: string[];
  
  // Stats (updated during execution)
  toolCount: number;
  tokens: number; // 0 if unavailable
  durationMs: number; // 0 while running, filled on completion
  
  // Live activity
  currentTool?: string;
  currentToolArgs?: string;
  currentToolStartedAt?: number;
  lastActivityAt?: number;
  activityState?: string;
  
  // Live output for expanded view
  recentOutput: string[]; // last ~5 lines of stdout
  
  // Recent tools for expanded view
  recentTools: Array<{ tool: string; args: string }>;
  
  // Error info
  error?: string;
  
  // Artifacts
  sessionFile?: string;
  outputFile?: string;
}

export function createInitialState(agent: string, model: string): SubagentState {
  return {
    agent,
    status: "pending",
    model,
    attemptedModels: [model],
    toolCount: 0,
    tokens: 0,
    durationMs: 0,
    recentOutput: [],
    recentTools: [],
  };
}

export const WIDGET_KEY = "subagent-dispatch";
export const WIDGET_ANIMATION_MS = 80;

export const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export function spinnerFrame(): string {
  return SPINNER[Math.floor(Date.now() / WIDGET_ANIMATION_MS) % SPINNER.length];
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

export function formatTokens(tokens: number): string {
  if (tokens < 1000) return String(tokens);
  return `${(tokens / 1000).toFixed(1)}k`;
}
