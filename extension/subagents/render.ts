import { Text } from "@earendil-works/pi-tui";
import type { Component } from "@earendil-works/pi-tui";
import type { Theme } from "@mariozechner/pi-coding-agent";
import {
  type SubagentState,
  type DispatchDetails,
  formatDuration,
  formatTokens,
} from "./types";

const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const ANIMATION_INTERVAL_MS = 80;

function spinnerFrame(): string {
  return SPINNER[Math.floor(Date.now() / ANIMATION_INTERVAL_MS) % SPINNER.length];
}

function bold(theme: Theme, text: string): string {
  return theme.bold(text);
}

function accent(theme: Theme, text: string): string {
  return theme.fg("accent", text);
}

function success(theme: Theme, text: string): string {
  return theme.fg("success", text);
}

function error(theme: Theme, text: string): string {
  return theme.fg("error", text);
}

function dim(theme: Theme, text: string): string {
  return theme.fg("dim", text);
}

function renderSubject(state: SubagentState): string {
  return state.model || state.agent;
}

function renderLine(state: SubagentState, theme: Theme): string {
  const subject = renderSubject(state);

  if (state.status === "running") {
    const elapsed = formatDuration(Date.now() - state.dispatchStartedAt);
    const parts: string[] = [
      `${accent(theme, spinnerFrame())} ${bold(theme, subject)}`,
    ];
    if (state.toolCount > 0) parts.push(`${state.toolCount} tool${state.toolCount === 1 ? "" : "s"}`);
    if (state.tokens > 0) parts.push(`${formatTokens(state.tokens)} tok`);
    parts.push(elapsed);
    return parts.join(" · ");
  }

  if (state.status === "done") {
    const elapsed = formatDuration(state.durationMs || (Date.now() - state.dispatchStartedAt));
    const parts: string[] = [
      `${success(theme, "✓")} ${bold(theme, subject)}`,
    ];
    if (state.toolCount > 0) parts.push(`${state.toolCount} tool${state.toolCount === 1 ? "" : "s"}`);
    if (state.tokens > 0) parts.push(`${formatTokens(state.tokens)} tok`);
    parts.push(elapsed);
    return parts.join(" · ");
  }

  if (state.status === "failed") {
    const msg = state.error ? `${subject} — ${state.error}` : `${subject} — failed`;
    return `${error(theme, "✗")} ${bold(theme, msg)}`;
  }

  return dim(theme, `◦ ${bold(theme, subject)}`);
}

/** Renders live subagent progress for renderResult. */
export function renderResultView(
  details: DispatchDetails | undefined,
  theme: Theme,
  _context: { invalidate: () => void; state: Record<string, unknown> },
): Component {
  if (!details?.progress) {
    return new Text("no progress data", 0, 0);
  }

  return new Text(renderLine(details.progress, theme), 0, 0);
}
