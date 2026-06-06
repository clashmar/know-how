// extension/types.ts

/** Union of subagent lifecycle states. */
export type SubagentStatus = "pending" | "running" | "done" | "failed";

/** Tracks live and final state for a dispatched subagent. */
export interface SubagentState {
  agent: string;
  status: SubagentStatus;
  model: string;
  toolCount: number;
  tokens: number;
  durationMs: number;
  dispatchStartedAt: number;
  lastActivityAt: number;
  error?: string;
}

/** Creates the initial state for a dispatched subagent. */
export function createInitialState(agent: string, model: string, dispatchStartedAt: number): SubagentState {
  return {
    agent,
    status: "pending",
    model,
    toolCount: 0,
    tokens: 0,
    durationMs: 0,
    dispatchStartedAt,
    lastActivityAt: Date.now(),
  };
}

/** Formats milliseconds as a human-readable duration. */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

/** Formats a token count for compact display. */
export function formatTokens(tokens: number): string {
  if (tokens < 1000) return String(tokens);
  return `${(tokens / 1000).toFixed(1)}k`;
}

/** Details payload pushed via onUpdate for live progress. */
export interface DispatchDetails {
  results: DispatchResult[];
  progress: SubagentState;
  dispatchStartedAt: number;
}

/** Describes the output returned by a completed subagent. */
export interface DispatchResult {
  agent: string;
  task: string;
  output: string;
}
