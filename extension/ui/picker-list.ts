import { matchesKey, Key } from "@earendil-works/pi-tui";
import type { Theme } from "@mariozechner/pi-coding-agent";
import { wrapTextWithAnsi, truncateToWidth } from "@earendil-works/pi-tui";

/** An item in the picker list. */
export interface PickerItem {
  label: string;
  description?: string;
  value: string;
}

/**
 * A word-wrapping list picker with max-height scrolling window.
 * Labels and descriptions are word-wrapped to fit the available width.
 */
export class PickerList {
  private items: PickerItem[];
  private selectedIndex = 0;
  private theme: Theme;
  private maxLines: number;
  private cachedWidth?: number;
  private cachedLines?: string[];

  public onSelect?: (item: PickerItem) => void;
  public onCancel?: () => void;

  constructor(items: PickerItem[], theme: Theme, maxLines = 10) {
    this.items = items;
    this.theme = theme;
    this.maxLines = maxLines;
  }

  handleInput(data: string): void {
    if (matchesKey(data, Key.up) && this.selectedIndex > 0) {
      this.selectedIndex--;
      this.invalidate();
    } else if (matchesKey(data, Key.down) && this.selectedIndex < this.items.length - 1) {
      this.selectedIndex++;
      this.invalidate();
    } else if (matchesKey(data, Key.enter)) {
      this.onSelect?.(this.items[this.selectedIndex]!);
    } else if (matchesKey(data, Key.escape)) {
      this.onCancel?.();
    }
  }

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) {
      return this.cachedLines;
    }

    const lines: string[] = [];
    const contentWidth = Math.max(width - 2, 20);

    // Track which line range belongs to the selected item
    let selStart = 0;
    let selEnd = 0;
    let lineIdx = 0;

    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i]!;
      const isSelected = i === this.selectedIndex;
      const prefix = isSelected ? "→ " : "  ";

      if (i === this.selectedIndex) selStart = lineIdx;

      const wrappedLabel = wrapTextWithAnsi(item.label, contentWidth - prefix.length);
      for (let li = 0; li < wrappedLabel.length; li++) {
        const l = wrappedLabel[li]!;
        const linePrefix = li === 0 ? prefix : "  ";
        lines.push(isSelected ? this.theme.fg("accent", linePrefix + l) : linePrefix + l);
      }
      lineIdx += wrappedLabel.length;

      if (item.description) {
        const descPrefix = "   ";
        const wrappedDesc = wrapTextWithAnsi(item.description, contentWidth - descPrefix.length);
        for (const d of wrappedDesc) {
          lines.push(this.theme.fg("dim", descPrefix + d));
        }
        lineIdx += wrappedDesc.length;
      }

      if (i === this.selectedIndex) selEnd = lineIdx;
    }

    if (lines.length === 0) {
      lines.push(this.theme.fg("dim", "  (no options)"));
    }

    // Apply max-height scrolling window around selected item
    if (lines.length > this.maxLines) {
      const selHeight = selEnd - selStart;
      let windowStart = selStart - Math.floor((this.maxLines - selHeight) / 2);
      windowStart = Math.max(0, Math.min(windowStart, lines.length - this.maxLines));
      const windowEnd = Math.min(windowStart + this.maxLines, lines.length);

      const result: string[] = [];
      if (windowStart > 0) {
        result.push(this.theme.fg("dim", `  ↑ ${windowStart} lines above`));
      }
      for (let i = windowStart; i < windowEnd; i++) {
        result.push(lines[i]!);
      }
      if (windowEnd < lines.length) {
        result.push(this.theme.fg("dim", `  ↓ ${lines.length - windowEnd} lines below`));
      }

      this.cachedLines = result.map(l => truncateToWidth(l, width));
    } else {
      this.cachedLines = lines.map(l => truncateToWidth(l, width));
    }

    this.cachedWidth = width;
    return this.cachedLines;
  }

  invalidate(): void {
    this.cachedWidth = undefined;
    this.cachedLines = undefined;
  }
}
