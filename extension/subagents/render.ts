// extension/subagents/render.ts

import { Container, Text, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import type { Component } from "@earendil-works/pi-tui";
import type { Theme } from "@mariozechner/pi-coding-agent";
// @mariozechner/pi-coding-agent is deprecated upstream; will migrate when @samfp/pi-memory updates
import {
  type SubagentState,
  type DispatchDetails,
  spinnerFrame,
  formatDuration,
  formatTokens,
  ANIMATION_INTERVAL_MS,
} from "./types";

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

function renderWrappedText(
  container: Container,
  formatLine: (value: string) => string,
  firstPrefix: string,
  continuationPrefix: string,
  text: string,
  maxWidth: number,
): void {
  const sourceLines = text.split(/\r?\n/g);
  let isFirstLine = true;

  for (const sourceLine of sourceLines) {
    const prefix = isFirstLine ? firstPrefix : continuationPrefix;
    const availableWidth = Math.max(1, maxWidth - visibleWidth(prefix));
    const wrappedLines = wrapPlainText(sourceLine, availableWidth);

    for (const wrappedLine of wrappedLines) {
      const currentPrefix = isFirstLine ? firstPrefix : continuationPrefix;
      container.addChild(new Text(formatLine(`${currentPrefix}${wrappedLine}`), 0, 0));
      isFirstLine = false;
    }
  }
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

function statusGlyph(state: SubagentState, theme: Theme): string {
  if (state.status === "running") return accent(theme, spinnerFrame());
  if (state.status === "pending") return muted(theme, "◦");
  if (state.status === "done") return success(theme, "✓");
  return error(theme, "✗");
}

function taskForAgent(details: DispatchDetails): string {
  return details.results[0]?.task ?? "(task unavailable)";
}

function formatToolPreview(tool: { tool: string; args: string }): string {
  const args = tool.args.trim();
  if (!args) {
    return `→ ${tool.tool}`;
  }
  if (args.startsWith("$") || args.startsWith(`${tool.tool} `) || args === tool.tool) {
    return `→ ${args}`;
  }
  return `→ ${tool.tool}: ${args}`;
}

function renderStatsLine(state: SubagentState, theme: Theme): string {
  const parts: string[] = [];
  if (state.toolCount > 0) parts.push(`${state.toolCount} tool${state.toolCount === 1 ? "" : "s"}`);
  if (state.tokens > 0) parts.push(`${formatTokens(state.tokens)} tok`);
  if (state.model) parts.push(state.model);
  if (state.status === "done" && state.durationMs > 0) parts.push(formatDuration(state.durationMs));
  return parts.length > 0 ? dim(theme, `(${parts.join(" · ")})`) : "";
}

function renderSingleAgent(details: DispatchDetails, theme: Theme, width: number): Container {
  const container = new Container();
  const state = details.progress;
  const innerWidth = width - 4;
  const glyph = statusGlyph(state, theme);
  const task = taskForAgent(details);

  container.addChild(new Text(`${glyph} ${bold(theme, state.agent)}`, 0, 0));
  renderWrappedText(container, (value) => dim(theme, value), "  Task: ", "        ", task, innerWidth);

  if (state.recentTools.length > 0) {
    for (const tool of state.recentTools.slice(-3)) {
      renderWrappedText(container, (value) => warning(theme, value), "  ", "  ", formatToolPreview(tool), innerWidth);
    }
  } else if (state.status === "running") {
    const activity = state.currentToolArgs?.trim() || state.currentTool?.trim();
    if (activity) {
      renderWrappedText(container, (value) => warning(theme, value), "  ", "  ", `→ ${activity}`, innerWidth);
    } else {
      container.addChild(new Text(dim(theme, "  (running...)"), 0, 0));
    }
  }

  for (const line of state.recentOutput.slice(-3)) {
    renderWrappedText(container, (value) => muted(theme, value), "  ", "  ", line, innerWidth);
  }

  if (state.status === "failed" && state.error) {
    renderWrappedError(container, theme, "  Error: ", "         ", state.error, innerWidth);
  }

  const stats = renderStatsLine(state, theme);
  if (stats) {
    container.addChild(new Text(truncateToWidth(`  ${stats}`, innerWidth, "..."), 0, 0));
  }

  return container;
}

/** Renders live subagent progress for renderResult. */
export function renderResultView(
  details: DispatchDetails | undefined,
  theme: Theme,
  context: { invalidate: () => void; state: Record<string, unknown> },
): Component {
  if (!details?.progress) {
    return new Text("no progress data", 0, 0);
  }

  const state = details.progress;
  const isRunning = state.status === "running" || state.status === "pending";

  const animKey = "subagentResultAnimationTimer";
  if (isRunning) {
    if (!context.state[animKey]) {
      const timer = setInterval(() => {
        try { context.invalidate(); } catch { /* stale ctx */ }
      }, ANIMATION_INTERVAL_MS);
      if (typeof timer === "object" && "unref" in timer) {
        (timer as unknown as { unref(): void }).unref();
      }
      context.state[animKey] = timer;
    }
  } else {
    const timer = context.state[animKey] as ReturnType<typeof setInterval> | undefined;
    if (timer) {
      clearInterval(timer);
      delete context.state[animKey];
    }
  }

  return buildView(details, theme);
}

/** Renders a single agent's progress inline. */
export function buildView(details: DispatchDetails, theme: Theme): Component {
  const width = process.stdout.columns || 120;
  return renderSingleAgent(details, theme, width);
}
