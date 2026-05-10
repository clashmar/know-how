// extension/widget.ts

import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import { Container, Text, Spacer, truncateToWidth } from "@earendil-works/pi-tui";
import type { Component } from "@earendil-works/pi-tui";
import {
  type SubagentState,
  WIDGET_KEY,
  WIDGET_ANIMATION_MS,
  spinnerFrame,
  formatDuration,
  formatTokens,
} from "./types";

type Theme = ExtensionContext["ui"]["theme"];

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
  else if (state.status === "running") parts.push(formatDuration(now - (state.currentToolStartedAt ?? now)));
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
  const c = new Container();
  const w = width - 4;
  const stats = stateStats(state, theme);

  c.addChild(new Text(
    truncateToWidth(`${statusGlyph(state, theme)} ${bold(theme, state.agent)}${stats ? ` ${dim(theme, "·")} ${stats}` : ""}`, w, "..."),
    0, 0,
  ));

  if (state.status === "running") {
    const toolLine = currentToolLine(state, w);
    const activity = toolLine ?? "thinking…";
    c.addChild(new Text(truncateToWidth(dim(theme, `  ⎿  ${activity}`), w, "..."), 0, 0));
  } else if (state.status === "failed") {
    c.addChild(new Text(truncateToWidth(error(theme, `  ⎿  ${state.error ?? "failed"}`), w, "..."), 0, 0));
  } else if (state.status === "done") {
    c.addChild(new Text(truncateToWidth(dim(theme, `  ⎿  done, ${formatDuration(state.durationMs)}`), w, "..."), 0, 0));
  }

  return c;
}

/** Expanded single-agent renderer */
function renderExpandedSingle(state: SubagentState, theme: Theme, width: number): Container {
  const c = new Container();
  const w = width - 4;

  const stats = stateStats(state, theme);
  const glyph = state.status === "running" ? accent(theme, "running") :
    state.status === "done" ? success(theme, "ok") : error(theme, "failed");
  c.addChild(new Text(
    truncateToWidth(`${glyph} ${bold(theme, state.agent)}${stats ? ` ${dim(theme, "·")} ${stats}` : ""}`, w, "..."),
    0, 0,
  ));

  c.addChild(new Spacer(1));

  if (state.status === "running") {
    const toolLine = currentToolLine(state, w);
    if (toolLine) {
      c.addChild(new Text(truncateToWidth(warning(theme, `> ${toolLine}`), w, "..."), 0, 0));
    }
  }

  if (state.recentTools.length > 0) {
    for (const tool of state.recentTools.slice(-3)) {
      const maxArgs = Math.max(40, w - 24);
      const argsPreview = tool.args.length <= maxArgs ? tool.args : `${tool.args.slice(0, maxArgs)}...`;
      c.addChild(new Text(truncateToWidth(dim(theme, `  ${tool.tool}: ${argsPreview}`), w, "..."), 0, 0));
    }
    c.addChild(new Spacer(1));
  }

  const recentLines = state.recentOutput.slice(-5);
  if (recentLines.length > 0) {
    for (const line of recentLines) {
      c.addChild(new Text(truncateToWidth(muted(theme, `  ${line}`), w, "..."), 0, 0));
    }
    c.addChild(new Spacer(1));
  }

  if (state.status === "running") {
  } else if (state.status === "failed") {
    c.addChild(new Text(truncateToWidth(error(theme, `Error: ${state.error ?? "unknown"}`), w, "..."), 0, 0));
  } else if (state.status === "done") {
    c.addChild(new Text(truncateToWidth(success(theme, `Done, ${formatDuration(state.durationMs)}`), w, "..."), 0, 0));
  }

  return c;
}

/** Multi-agent tree layout */
function renderMultiAgent(states: SubagentState[], theme: Theme, width: number): Container {
  const c = new Container();
  const w = width - 4;

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

  c.addChild(new Text(
    truncateToWidth(`${glyph} ${bold(theme, "dispatch")} ${dim(theme, "·")} ${dim(theme, headerParts.join(", "))}`, w, "..."),
    0, 0,
  ));

  states.forEach((state, i) => {
    const isLast = i === states.length - 1;
    const branch = isLast ? "└─" : "├─";
    const cont = isLast ? "   " : "│  ";

    const stats = stateStats(state, theme);
    c.addChild(new Text(
      truncateToWidth(`${dim(theme, branch)} ${statusGlyph(state, theme)} ${bold(theme, state.agent)}${stats ? ` ${dim(theme, "·")} ${stats}` : ""}`, w, "..."),
      0, 0,
    ));

    if (state.status === "running") {
      const toolLine = currentToolLine(state, w);
      if (toolLine) {
        c.addChild(new Text(truncateToWidth(dim(theme, `${cont} ⎿  ${toolLine}`), w, "..."), 0, 0));
      }
    } else if (state.status === "failed" && state.error) {
      c.addChild(new Text(truncateToWidth(error(theme, `${cont} ⎿  ${state.error.slice(0, 60)}`), w, "..."), 0, 0));
    }
  });

  if (running > 0) {
  }

  return c;
}

/** Builds the subagent dispatch widget for a set of subagent states. */
export function buildWidget(
  states: SubagentState[],
  expanded: boolean,
): (_tui: unknown, theme: Theme) => Component {
  return (_tui, theme) => {
    const width = process.stdout.columns || 120;

    if (states.length === 0) return new Container();

    let component: Container;
    if (states.length === 1) {
      component = expanded
        ? renderExpandedSingle(states[0]!, theme, width)
        : renderCompactSingle(states[0]!, theme, width);
    } else {
      component = renderMultiAgent(states, theme, width);
    }

    return component;
  };
}

// Widget state
let widgetCtx: ExtensionContext | undefined;
let widgetStates: SubagentState[] = [];
let widgetTimer: ReturnType<typeof setInterval> | undefined;
let widgetExpanded = false;

function hasRunning(states: SubagentState[]): boolean {
  return states.some(s => s.status === "running" || s.status === "pending");
}

function isStaleError(err: unknown): boolean {
  return err instanceof Error && err.message.includes("stale");
}

function refreshWidget(): void {
  try {
    if (!widgetCtx?.hasUI || widgetStates.length === 0) return;
    widgetCtx.ui.setWidget(WIDGET_KEY, buildWidget(widgetStates, widgetExpanded));
  } catch (err) {
    if (!isStaleError(err)) throw err;
    stopWidgetAnimation();
  }
}

function ensureWidgetAnimation(): void {
  if (widgetTimer) return;
  widgetTimer = setInterval(() => {
    if (!hasRunning(widgetStates)) {
      stopWidgetAnimation();
      refreshWidget();
      return;
    }
    refreshWidget();
  }, WIDGET_ANIMATION_MS);
  if (typeof widgetTimer === "object" && "unref" in widgetTimer) {
    (widgetTimer as unknown as { unref(): void }).unref();
  }
}

/** Stops the widget refresh animation and clears state. */
export function stopWidgetAnimation(): void {
  if (widgetTimer) {
    clearInterval(widgetTimer);
    widgetTimer = undefined;
  }
  widgetCtx = undefined;
  widgetStates = [];
}

/** Renders or clears the subagent dispatch widget in the TUI. */
export function renderWidget(ctx: ExtensionContext, states: SubagentState[]): void {
  if (states.length === 0) {
    stopWidgetAnimation();
    if (ctx.hasUI) ctx.ui.setWidget(WIDGET_KEY, undefined);
    return;
  }
  if (!ctx.hasUI) {
    stopWidgetAnimation();
    return;
  }

  widgetCtx = ctx;
  widgetStates = [...states];

  ctx.ui.setWidget(WIDGET_KEY, buildWidget(states, widgetExpanded));

  if (hasRunning(states)) ensureWidgetAnimation();
  else stopWidgetAnimation();
}

/** Toggles between compact and expanded agent display mode. */
export function toggleExpanded(): void {
  widgetExpanded = !widgetExpanded;
}

/** Returns whether the widget is in expanded display mode. */
export function isExpanded(): boolean {
  return widgetExpanded;
}
