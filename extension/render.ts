// extension/render.ts

import { Container, Text, Spacer, truncateToWidth } from "@earendil-works/pi-tui";
import type { Component } from "@earendil-works/pi-tui";
import {
  type SubagentState,
  type DispatchDetails,
  spinnerFrame,
  formatDuration,
  formatTokens,
  ANIMATION_INTERVAL_MS,
} from "./types";

interface Theme {
  bold(text: string): string;
  fg(color: string, text: string): string;
}

function bold(theme: Theme, text: string): string {
  return theme.bold(text);
}

function dim(theme: Theme, text: string): string {
  return theme.fg("dim", text);
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

function warning(theme: Theme, text: string): string {
  return theme.fg("warning", text);
}

function muted(theme: Theme, text: string): string {
  return theme.fg("muted", text);
}

function statJoin(theme: Theme, parts: string[]): string {
  return parts.filter(Boolean).map((p) => dim(theme, p)).join(` ${dim(theme, "·")} `);
}

function stateStats(state: SubagentState, theme: Theme): string {
  const now = Date.now();
  const parts: string[] = [];
  if (state.toolCount > 0) parts.push(`${state.toolCount} tool${state.toolCount === 1 ? "" : "s"}`);
  if (state.tokens > 0) parts.push(`${formatTokens(state.tokens)} tok`);
  if (state.durationMs > 0) parts.push(formatDuration(state.durationMs));
  else if (state.status === "running") parts.push(formatDuration(now - (state.lastActivityAt ?? now)));
  if (state.model) parts.push(state.model);
  return statJoin(theme, parts);
}

function statusGlyph(state: SubagentState, theme: Theme): string {
  if (state.status === "running") return accent(theme, spinnerFrame());
  if (state.status === "pending") return muted(theme, "◦");
  if (state.status === "done") return success(theme, "✓");
  return error(theme, "✗");
}

function currentToolLine(state: SubagentState, width: number): string | undefined {
  if (!state.currentTool) return undefined;
  const maxArgs = Math.max(50, width - 20);
  const args = state.currentToolArgs
    ? (state.currentToolArgs.length <= maxArgs ? state.currentToolArgs : `${state.currentToolArgs.slice(0, maxArgs)}...`)
    : "";
  const duration = state.currentToolStartedAt !== undefined
    ? ` | ${formatDuration(Math.max(0, Date.now() - state.currentToolStartedAt))}`
    : "";
  return args ? `${state.currentTool}: ${args}${duration}` : `${state.currentTool}${duration}`;
}

function renderCompactSingle(state: SubagentState, theme: Theme, width: number): Container {
  const container = new Container();
  const innerWidth = width - 4;
  const stats = stateStats(state, theme);

  container.addChild(new Text(
    truncateToWidth(`${statusGlyph(state, theme)} ${bold(theme, state.agent)}${stats ? ` ${dim(theme, "·")} ${stats}` : ""}`, innerWidth, "..."),
    0, 0,
  ));

  if (state.status === "running") {
    const toolLine = currentToolLine(state, innerWidth);
    const activity = toolLine ?? "thinking…";
    container.addChild(new Text(truncateToWidth(dim(theme, `  ⎿  ${activity}`), innerWidth, "..."), 0, 0));
  } else if (state.status === "failed") {
    container.addChild(new Text(truncateToWidth(error(theme, `  ⎿  ${state.error ?? "failed"}`), innerWidth, "..."), 0, 0));
  } else if (state.status === "done") {
    container.addChild(new Text(truncateToWidth(dim(theme, `  ⎿  done, ${formatDuration(state.durationMs)}`), innerWidth, "..."), 0, 0));
  }

  return container;
}

/** Expanded single-agent renderer */
function renderExpandedSingle(state: SubagentState, theme: Theme, width: number): Container {
  const container = new Container();
  const innerWidth = width - 4;

  const stats = stateStats(state, theme);
  const glyph = state.status === "running" ? accent(theme, "running") :
    state.status === "done" ? success(theme, "ok") :
    state.status === "pending" ? muted(theme, "pending") :
    error(theme, "failed");
  container.addChild(new Text(
    truncateToWidth(`${glyph} ${bold(theme, state.agent)}${stats ? ` ${dim(theme, "·")} ${stats}` : ""}`, innerWidth, "..."),
    0, 0,
  ));

  container.addChild(new Spacer(1));

  if (state.status === "running") {
    const toolLine = currentToolLine(state, innerWidth);
    if (toolLine) {
      container.addChild(new Text(truncateToWidth(warning(theme, `> ${toolLine}`), innerWidth, "..."), 0, 0));
    }
  }

  if (state.recentTools.length > 0) {
    for (const tool of state.recentTools.slice(-3)) {
      const maxArgs = Math.max(40, innerWidth - 24);
      const argsPreview = tool.args.length <= maxArgs ? tool.args : `${tool.args.slice(0, maxArgs)}...`;
      container.addChild(new Text(truncateToWidth(dim(theme, `  ${tool.tool}: ${argsPreview}`), innerWidth, "..."), 0, 0));
    }
    container.addChild(new Spacer(1));
  }

  const recentLines = state.recentOutput.slice(-5);
  if (recentLines.length > 0) {
    for (const line of recentLines) {
      container.addChild(new Text(truncateToWidth(muted(theme, `  ${line}`), innerWidth, "..."), 0, 0));
    }
    container.addChild(new Spacer(1));
  }

  if (state.status === "failed") {
    container.addChild(new Text(truncateToWidth(error(theme, `Error: ${state.error ?? "unknown"}`), innerWidth, "..."), 0, 0));
  } else if (state.status === "done") {
    container.addChild(new Text(truncateToWidth(success(theme, `Done, ${formatDuration(state.durationMs)}`), innerWidth, "..."), 0, 0));
  }

  return container;
}

/** Multi-agent tree layout */
function renderMultiAgent(states: SubagentState[], theme: Theme, width: number): Container {
  const container = new Container();
  const innerWidth = width - 4;

  const running = states.filter(s => s.status === "running").length;
  const done = states.filter(s => s.status === "done").length;
  const failed = states.filter(s => s.status === "failed").length;

  let glyph: string;
  if (running > 0) glyph = accent(theme, spinnerFrame());
  else if (failed > 0) glyph = error(theme, "✗");
  else glyph = success(theme, "✓");

  const headerParts = [];
  if (running > 0) headerParts.push(`${running} running`);
  headerParts.push(`${done}/${states.length} done`);
  if (failed > 0) headerParts.push(`${failed} failed`);

  container.addChild(new Text(
    truncateToWidth(`${glyph} ${bold(theme, "dispatch")} ${dim(theme, "·")} ${dim(theme, headerParts.join(", "))}`, innerWidth, "..."),
    0, 0,
  ));

  states.forEach((state, i) => {
    const isLast = i === states.length - 1;
    const branch = isLast ? "└─" : "├─";
    const cont = isLast ? "   " : "│  ";

    const stats = stateStats(state, theme);
    container.addChild(new Text(
      truncateToWidth(`${dim(theme, branch)} ${statusGlyph(state, theme)} ${bold(theme, state.agent)}${stats ? ` ${dim(theme, "·")} ${stats}` : ""}`, innerWidth, "..."),
      0, 0,
    ));

    if (state.status === "running") {
      const toolLine = currentToolLine(state, innerWidth);
      if (toolLine) {
        container.addChild(new Text(truncateToWidth(dim(theme, `${cont} ⎿  ${toolLine}`), innerWidth, "..."), 0, 0));
      }
    } else if (state.status === "failed" && state.error) {
      container.addChild(new Text(truncateToWidth(error(theme, `${cont} ⎿  ${state.error.slice(0, 60)}`), innerWidth, "..."), 0, 0));
    }
  });

  return container;
}

/** Renders live subagent progress for renderResult. */
export function renderResultView(
  details: DispatchDetails | undefined,
  theme: Theme,
  context: { invalidate: () => void; state: Record<string, unknown> },
): Component {
  const width = process.stdout.columns || 120;

  if (!details || details.progress.length === 0) {
    return new Text("no progress data", 0, 0);
  }

  const states = details.progress;
  const hasRunning = states.some(s => s.status === "running" || s.status === "pending");

  // Animation timer — re-render while agents are running
  const ANIM_KEY = "subagentResultAnimationTimer";
  if (hasRunning) {
    if (!context.state[ANIM_KEY]) {
      const timer = setInterval(() => {
        try { context.invalidate(); } catch { /* stale ctx */ }
      }, ANIMATION_INTERVAL_MS);
      if (typeof timer === "object" && "unref" in timer) {
        (timer as unknown as { unref(): void }).unref();
      }
      context.state[ANIM_KEY] = timer;
    }
  } else {
    const timer = context.state[ANIM_KEY] as ReturnType<typeof setInterval> | undefined;
    if (timer) {
      clearInterval(timer);
      delete context.state[ANIM_KEY];
    }
  }

  return buildView(states, false, theme);
}

/** Renders subagent states as a compact, expanded, or multi-agent tree layout. */
export function buildView(
  states: SubagentState[],
  expanded: boolean,
  theme: Theme,
): Component {
  const width = process.stdout.columns || 120;

  if (states.length === 0) return new Container();

  if (states.length === 1) {
    return expanded
      ? renderExpandedSingle(states[0]!, theme, width)
      : renderCompactSingle(states[0]!, theme, width);
  }

  return renderMultiAgent(states, theme, width);
}
