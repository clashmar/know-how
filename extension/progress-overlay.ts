/**
 * Progress overlay UI for /progress command.
 *
 * Manages picker (multi-agent) and detail (single/selected agent) views.
 * Index-based agent resolution ensures repeated agent types map correctly.
 */

import { Box, Container, Text, Spacer, truncateToWidth, matchesKey, Key, type Component } from "@earendil-works/pi-tui";
import type { DispatchDetails, SubagentState } from "./types";
import { formatDuration, formatTokens, spinnerFrame } from "./types";

// ── Type Definitions ──────────────────────────────────────────────

interface TuiContext {
  requestRender?: () => void;
}

interface AgentViewModel {
  index: number;
  progress: SubagentState;
  result?: { output: string };
}

interface Theme {
  bold(text: string): string;
  fg(color: string, text: string): string;
  bg(color: string, text: string): string;
}

/** Shape of the UI context required by the progress overlay. */
export interface OverlayContext {
  ui: {
    custom: <T>(
      factory: (tui: TuiContext, theme: Theme, keybindings: unknown, done: (result: T) => void) => Component,
      options?: { overlay: boolean }
    ) => Promise<T>;
    notify: (message: string, type: string) => void;
  };
}

// ── Role Colors ───────────────────────────────────────────────────

const ROLE_BG_COLORS: Record<string, number> = {
  scout: 17,
  worker: 22,
  reviewer: 53,
  guardian: 23,
  maester: 58,
};
const DEFAULT_BG_COLOR = 236;

function roleBgFn(agent: string): (s: string) => string {
  const color = ROLE_BG_COLORS[agent] ?? DEFAULT_BG_COLOR;
  return (s: string) => `\x1b[48;5;${color}m${s}\x1b[49m`;
}

// ── View Builders ─────────────────────────────────────────────────

function getAgentViewModel(details: DispatchDetails, index: number): AgentViewModel {
  const progress = details.progress[index]!;
  const result = details.results[index];
  return { index, progress, result };
}

function buildMetadataLine(progress: SubagentState, theme: Theme): string {
  const parts: string[] = [];
  if (progress.toolCount > 0) parts.push(`${progress.toolCount} tool${progress.toolCount === 1 ? "" : "s"}`);
  if (progress.tokens > 0) parts.push(`${formatTokens(progress.tokens)} tok`);
  if (progress.model) parts.push(progress.model);
  if (progress.durationMs > 0) parts.push(formatDuration(progress.durationMs));
  return parts.filter(Boolean).map((p) => theme.fg("text", p)).join(` ${theme.fg("text", "·")} `);
}

function buildRunningView(vm: AgentViewModel, theme: Theme, width: number): Container {
  const container = new Container();
  const innerWidth = Math.max(width - 4, 40);

  container.addChild(new Text(
    theme.bold(`${vm.progress.agent} — running`),
    0, 0,
  ));
  container.addChild(new Text(buildMetadataLine(vm.progress, theme), 0, 0));
  container.addChild(new Spacer(1));

  if (vm.progress.recentTools.length > 0) {
    container.addChild(new Text(theme.fg("text", "Recent tools:"), 0, 0));
    for (const tool of vm.progress.recentTools) {
      container.addChild(new Text(
        truncateToWidth(theme.fg("text", `  • ${tool.tool}`), innerWidth, "..."),
        0, 0,
      ));
    }
  }

  if (vm.progress.recentOutput.length > 0) {
    container.addChild(new Spacer(1));
    container.addChild(new Text(theme.fg("text", "Output:"), 0, 0));
    for (const line of vm.progress.recentOutput) {
      container.addChild(new Text(
        truncateToWidth(theme.fg("text", `  ${line}`), innerWidth, "..."),
        0, 0,
      ));
    }
  }

  return container;
}

function buildDoneView(vm: AgentViewModel, theme: Theme, width: number): Container {
  const container = new Container();
  const innerWidth = Math.max(width - 4, 40);

  const statusIcon = theme.fg("success", "✓");
  container.addChild(new Text(
    `${statusIcon} ${theme.bold(vm.progress.agent)} — done`,
    0, 0,
  ));
  container.addChild(new Text(buildMetadataLine(vm.progress, theme), 0, 0));
  container.addChild(new Spacer(1));

  const output = vm.result?.output?.trim() || "No final report text returned.";
  const lines = output.split("\n");
  for (const line of lines) {
    container.addChild(new Text(
      truncateToWidth(theme.fg("text", line), innerWidth, "..."),
      0, 0,
    ));
  }

  return container;
}

function buildFailedView(vm: AgentViewModel, theme: Theme, width: number): Container {
  const container = new Container();
  const innerWidth = Math.max(width - 4, 40);

  const statusIcon = theme.fg("error", "✗");
  container.addChild(new Text(
    `${statusIcon} ${theme.bold(vm.progress.agent)} — failed`,
    0, 0,
  ));
  container.addChild(new Text(buildMetadataLine(vm.progress, theme), 0, 0));
  container.addChild(new Spacer(1));

  const error = vm.progress.error ?? "No error message recorded.";
  container.addChild(new Text(
    truncateToWidth(theme.fg("error", error), innerWidth, "..."),
    0, 0,
  ));

  return container;
}

// ── Detail View ───────────────────────────────────────────────────

class DetailOverlay {
  private getDetails: DispatchDetailsGetter;
  private index: number;
  private theme: Theme;
  private done: () => void;
  private closed: boolean = false;

  constructor(getDetails: DispatchDetailsGetter, index: number, theme: Theme, done: () => void) {
    this.getDetails = getDetails;
    this.index = index;
    this.theme = theme;
    this.done = done;
  }

  handleInput(data: string): void {
    if (this.closed) return;
    if (matchesKey(data, Key.escape)) {
      this.done();
    }
  }

  render(width: number): string[] {
    if (this.closed) return [];
    const details = this.getDetails();
    if (!details) {
      this.closed = true;
      this.done();
      return [];
    }

    const vm = getAgentViewModel(details, this.index);
    let content: Container;
    if (vm.progress.status === "running" || vm.progress.status === "pending") {
      content = buildRunningView(vm, this.theme, width);
    } else if (vm.progress.status === "done") {
      content = buildDoneView(vm, this.theme, width);
    } else {
      content = buildFailedView(vm, this.theme, width);
    }

    if (isDispatchComplete(details)) {
      this.closed = true;
      this.done();
      return [];
    }

    const bgFn = roleBgFn(vm.progress.agent);
    const box = new Box(1, 1, bgFn);
    box.addChild(content);
    box.addChild(new Spacer(1));
    box.addChild(new Text(this.theme.fg("text", "esc close"), 0, 0));
    return box.render(width);
  }

  invalidate(): void {
    // Component interface requirement; no state caching needed
  }
}

// ── Picker Overlay ────────────────────────────────────────────────

class PickerOverlay {
  private details: DispatchDetails;
  private theme: Theme;
  private selectedIndex: number = 0;
  public onSelect?: (index: number) => void;
  public onClose?: () => void;

  constructor(details: DispatchDetails, theme: Theme) {
    this.details = details;
    this.theme = theme;
  }

  handleInput(data: string): void {
    if (matchesKey(data, Key.up) && this.selectedIndex > 0) {
      this.selectedIndex--;
    } else if (matchesKey(data, Key.down) && this.selectedIndex < this.details.progress.length - 1) {
      this.selectedIndex++;
    } else if (matchesKey(data, Key.enter)) {
      this.onSelect?.(this.selectedIndex);
    } else if (matchesKey(data, Key.escape)) {
      this.onClose?.();
    }
  }

  render(width: number): string[] {
    const innerWidth = Math.max(width - 4, 40);
    const box = new Box(1, 1, (s: string) => this.theme.bg("customMessageBg", s));

    box.addChild(new Text(this.theme.bold("Select Agent"), 0, 0));
    box.addChild(new Spacer(1));

    for (let i = 0; i < this.details.progress.length; i++) {
      const progress = this.details.progress[i]!;
      const isSelected = i === this.selectedIndex;
      const prefix = isSelected ? this.theme.fg("accent", "> ") : "  ";

      const metadata = [
        progress.agent,
        progress.status,
        progress.model,
      ].filter(Boolean).join(` ${this.theme.fg("dim", "·")} `);

      const line = `${prefix}${metadata}`;
      box.addChild(new Text(
        truncateToWidth(
          isSelected ? this.theme.fg("accent", line) : line,
          innerWidth,
          "...",
        ),
        0, 0,
      ));
    }

    box.addChild(new Spacer(1));
    box.addChild(new Text(this.theme.fg("dim", "↑↓ navigate • enter select • esc close"), 0, 0));

    return box.render(width);
  }

  invalidate(): void {
    // No cached state
  }
}

// ── Main Export ───────────────────────────────────────────────────

/** Getter that returns the latest dispatch snapshot. */
export type DispatchDetailsGetter = () => DispatchDetails | undefined;

/** Displays a progress overlay showing dispatch and agent details. */
export function openProgressOverlay(
  ctx: OverlayContext,
  getDetails: DispatchDetailsGetter,
): void {
  const details = getDetails();
  if (!details || details.progress.length === 0) {
    ctx.ui.notify("No dispatch progress available.", "info");
    return;
  }

  if (details.progress.length === 1) {
    openDetailOverlay(ctx, getDetails, 0);
  } else {
    openPickerOverlay(ctx, getDetails);
  }
}

function openPickerOverlay(ctx: OverlayContext, getDetails: DispatchDetailsGetter): void {
  ctx.ui.custom(
    (tui: TuiContext, theme: Theme, _keybindings: unknown, done: (result: unknown) => void) => {
      const details = getDetails()!;
      const picker = new PickerOverlay(details, theme);

      picker.onSelect = (index) => {
        done(index);
        openDetailOverlay(ctx, getDetails, index);
      };

      picker.onClose = () => {
        done(null);
      };

      return {
        render: (w: number) => picker.render(w),
        handleInput: (data: string) => { picker.handleInput(data); tui.requestRender?.(); },
        invalidate: () => picker.invalidate(),
      };
    },
    { overlay: true },
  );
}

function isDispatchComplete(details: DispatchDetails): boolean {
  return details.progress.every(s => s.status === "done" || s.status === "failed");
}

function openDetailOverlay(
  ctx: OverlayContext,
  getDetails: DispatchDetailsGetter,
  index: number,
): void {
  ctx.ui.custom(
    (tui: TuiContext, theme: Theme, _keybindings: unknown, done: (result: unknown) => void) => {
      const detail = new DetailOverlay(getDetails, index, theme, () => done(null));

      return {
        render: (w: number) => detail.render(w),
        handleInput: (data: string) => detail.handleInput(data),
        invalidate: () => detail.invalidate(),
      };
    },
    { overlay: true },
  );
}
