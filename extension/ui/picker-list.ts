import { matchesKey, Key, Text, Container, Spacer } from "@earendil-works/pi-tui";
import type { Theme } from "@mariozechner/pi-coding-agent";
import { wrapTextWithAnsi, truncateToWidth } from "@earendil-works/pi-tui";

/** An item in the picker list. */
export interface PickerItem {
  label: string;
  description?: string;
  value: string;
}

/**
 * A word-wrapping list picker (replaces SelectList for better text handling).
 * Labels and descriptions are word-wrapped to fit the available width.
 */
export class PickerList {
  private items: PickerItem[];
  private selectedIndex = 0;
  private theme: Theme;
  private cachedWidth?: number;
  private cachedLines?: string[];

  public onSelect?: (item: PickerItem) => void;
  public onCancel?: () => void;

  constructor(items: PickerItem[], theme: Theme) {
    this.items = items;
    this.theme = theme;
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

    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i]!;
      const isSelected = i === this.selectedIndex;
      const prefix = isSelected ? "→ " : "  ";

      // Render label — word-wrapped, selected in accent. First line gets arrow, continuation lines are indented.
      const wrappedLabel = wrapTextWithAnsi(item.label, contentWidth - prefix.length);
      for (let li = 0; li < wrappedLabel.length; li++) {
        const l = wrappedLabel[li]!;
        const linePrefix = li === 0 ? prefix : "  ";
        lines.push(isSelected ? this.theme.fg("accent", linePrefix + l) : linePrefix + l);
      }

      // Render description below label — indented, dim, word-wrapped
      if (item.description) {
        const descPrefix = "   ";
        const wrappedDesc = wrapTextWithAnsi(item.description, contentWidth - descPrefix.length);
        for (const d of wrappedDesc) {
          lines.push(this.theme.fg("dim", descPrefix + d));
        }
      }
    }

    // Empty state
    if (lines.length === 0) {
      lines.push(this.theme.fg("dim", "  (no options)"));
    }

    this.cachedLines = lines.map(l => truncateToWidth(l, width));
    this.cachedWidth = width;
    return this.cachedLines;
  }

  invalidate(): void {
    this.cachedWidth = undefined;
    this.cachedLines = undefined;
  }
}
