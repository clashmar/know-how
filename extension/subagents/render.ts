// extension/render.ts

import { Container, Text, Spacer, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
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
  bg(color: string, text: string): string;
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

function normalizeErrorLines(errorText: string): string[] {
  const lines = errorText
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  return lines.length > 0 ? lines : [""];
}

function wrapPlainText(text: string, maxWidth: number): string[] {
  if (maxWidth <= 0) return [""];
  if (text.length === 0) return [""];

  const wrapped: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (visibleWidth(remaining) <= maxWidth) {
      wrapped.push(remaining);
      break;
    }

    let cut = remaining.length;
    while (cut > 0 && visibleWidth(remaining.slice(0, cut)) > maxWidth) {
      cut -= 1;
    }

    if (cut <= 0) {
      wrapped.push(remaining);
      break;
    }

    let breakAt = remaining.lastIndexOf(" ", cut);
    if (breakAt <= 0) {
      breakAt = cut;
    }

    const line = remaining.slice(0, breakAt).trimEnd();
    if (line.length > 0) {
      wrapped.push(line);
    }
    remaining = remaining.slice(breakAt).trimStart();
  }

  return wrapped.length > 0 ? wrapped : [""];
}

function renderWrappedError(
  container: Container,
  theme: Theme,
  firstPrefix: string,
  continuationPrefix: string,
  errorText: string,
  maxWidth: number,
): void {
  let isFirstLine = true;

  for (const sourceLine of normalizeErrorLines(errorText)) {
    const prefix = isFirstLine ? firstPrefix : continuationPrefix;
    const availableWidth = Math.max(1, maxWidth - visibleWidth(prefix));
    const wrappedLines = wrapPlainText(sourceLine, availableWidth);

    for (const wrappedLine of wrappedLines) {
      const currentPrefix = isFirstLine ? firstPrefix : continuationPrefix;
      container.addChild(new Text(error(theme, `${currentPrefix}${wrappedLine}`), 0, 0));
      isFirstLine = false;
    }
  }
}

function statJoin(theme: Theme, parts: string[]): string {
  return parts.filter(Boolean).map((p) => dim(theme, p)).join(` ${dim(theme, "·")} `);
}

function joinPlainStats(parts: string[]): string {
  return parts.join(" · ");
}

// Never truncate the styled header line; fit raw text first or the ellipsis can lose background fill.
function fitPlainText(text: string, maxWidth: number): string {
  if (maxWidth <= 0) return "";
  if (visibleWidth(text) <= maxWidth) return text;
  if (maxWidth === 1) return "…";

  let truncated = text;
  while (truncated.length > 0 && visibleWidth(`${truncated}…`) > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return truncated.length > 0 ? `${truncated}…` : "…";
}

function stateStats(state: SubagentState, theme: Theme, maxStatsWidth?: number): string {
  const parts: string[] = [];
  if (state.toolCount > 0) parts.push(`${state.toolCount} tool${state.toolCount === 1 ? "" : "s"}`);
  if (state.tokens > 0) parts.push(`${formatTokens(state.tokens)} tok`);
  if (state.model) {
    if (maxStatsWidth === undefined) {
      parts.push(state.model);
    } else {
      const usedWidth = visibleWidth(joinPlainStats(parts));
      const separatorWidth = parts.length > 0 ? 3 : 0;
      const availableWidth = maxStatsWidth - usedWidth - separatorWidth;
      const model = fitPlainText(state.model, availableWidth);
      if (model) {
        parts.push(model);
      }
    }
  }
  return statJoin(theme, parts);
}

function buildStateHeaderLine(
  prefix: string,
  state: SubagentState,
  theme: Theme,
  maxWidth: number,
): string {
  const statsMaxWidth = Math.max(0, maxWidth - visibleWidth(prefix) - 3);
  const stats = stateStats(state, theme, statsMaxWidth);
  return stats ? `${prefix} ${dim(theme, "·")} ${stats}` : prefix;
}

function renderStateHeader(
  container: Container,
  state: SubagentState,
  theme: Theme,
  glyph: string,
  maxWidth: number,
): void {
  const prefix = `${glyph} ${bold(theme, state.agent)}`;
  container.addChild(new Text(buildStateHeaderLine(prefix, state, theme, maxWidth), 0, 0));
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
  renderStateHeader(container, state, theme, statusGlyph(state, theme), innerWidth);

  if (state.status === "running") {
    const toolLine = currentToolLine(state, innerWidth);
    const activity = toolLine ?? "thinking…";
    container.addChild(new Text(truncateToWidth(dim(theme, `  ⎿  ${activity}`), innerWidth, "..."), 0, 0));
  } else if (state.status === "failed") {
    renderWrappedError(container, theme, "  ⎿  ", "     ", state.error ?? "failed", innerWidth);
  } else if (state.status === "done") {
    container.addChild(new Text(truncateToWidth(dim(theme, `  ⎿  done, ${formatDuration(state.durationMs)}`), innerWidth, "..."), 0, 0));
  }

  return container;
}

/** Expanded single-agent renderer */
function renderExpandedSingle(state: SubagentState, theme: Theme, width: number): Container {
  const container = new Container();
  const innerWidth = width - 4;

  const glyph = state.status === "running" ? accent(theme, "running") :
    state.status === "done" ? success(theme, "ok") :
    state.status === "pending" ? muted(theme, "pending") :
    error(theme, "failed");
  renderStateHeader(container, state, theme, glyph, innerWidth);

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
    renderWrappedError(container, theme, "Error: ", "       ", state.error ?? "unknown", innerWidth);
  } else if (state.status === "done") {
    container.addChild(new Text(truncateToWidth(success(theme, `Done, ${formatDuration(state.durationMs)}`), innerWidth, "..."), 0, 0));
  }

  return container;
}

/** Multi-agent tree layout */
function renderMultiAgent(states: SubagentState[], theme: Theme, width: number, dispatchStartedAt: number): Container {
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

  const hasStarted = states.some(s => s.status !== "pending");
  const elapsed = hasStarted ? formatDuration(Date.now() - dispatchStartedAt) : "starting";

  container.addChild(new Text(
    truncateToWidth(`${glyph} ${bold(theme, "dispatch")} ${dim(theme, "·")} ${dim(theme, elapsed)} ${dim(theme, "·")} ${dim(theme, headerParts.join(", "))}`, innerWidth, "..."),
    0, 0,
  ));

  states.forEach((state, i) => {
    const isLast = i === states.length - 1;
    const branch = isLast ? "└─" : "├─";
    const cont = isLast ? "   " : "│  ";

    const prefix = `${dim(theme, branch)} ${statusGlyph(state, theme)} ${bold(theme, state.agent)}`;
    container.addChild(new Text(buildStateHeaderLine(prefix, state, theme, innerWidth), 0, 0));

    if (state.status === "running") {
      const toolLine = currentToolLine(state, innerWidth);
      if (toolLine) {
        container.addChild(new Text(truncateToWidth(dim(theme, `${cont} ⎿  ${toolLine}`), innerWidth, "..."), 0, 0));
      }
    } else if (state.status === "failed" && state.error) {
      const firstPrefix = `${cont} ⎿  `;
      const continuationPrefix = " ".repeat(visibleWidth(firstPrefix));
      renderWrappedError(container, theme, firstPrefix, continuationPrefix, state.error, innerWidth);
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

  return buildView(states, false, theme, details.dispatchStartedAt);
}

/** Renders subagent states as a compact, expanded, or multi-agent tree layout. */
export function buildView(
  states: SubagentState[],
  expanded: boolean,
  theme: Theme,
  dispatchStartedAt: number,
): Component {
  const width = process.stdout.columns || 120;

  if (states.length === 0) return new Container();

  if (states.length === 1) {
    return expanded
      ? renderExpandedSingle(states[0]!, theme, width)
      : renderCompactSingle(states[0]!, theme, width);
  }

  return renderMultiAgent(states, theme, width, dispatchStartedAt);
}
