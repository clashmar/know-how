import { matchesKey, Key, Text, Input, Container, Spacer, truncateToWidth } from "@earendil-works/pi-tui";
import type { Theme } from "@mariozechner/pi-coding-agent"; 
// @mariozechner/pi-coding-agent is deprecated upstream; will migrate when @samfp/pi-memory updates
import { PickerList } from "./picker-list";
import type { PickerItem } from "./picker-list";
import { OTHER_VALUE } from "./choice-picker";
import { isInReadMode } from "../write-mode/read-mode";
import { borderColor, BORDER_CHAR } from "./border-style";

/**
 * An option in a decision form.
 */
export interface DecisionOption {
  label: string;
  value: string;
  description?: string;
}

/**
 * A decision to be made in the form.
 */
export interface Decision {
  label: string;
  tooltip?: string;
  options: DecisionOption[];
  otherLabel?: string;
}

/**
 * Per-decision state tracking selections.
 */
export interface DecisionState {
  selectedValue: string;
  otherText: string;
}

/**
 * A tabbed multi-decision TUI form for collecting multiple choices at once.
 */
export class DecisionForm {
  private container: Container;
  private tabRow: Container;
  private contentArea: Container;
  private decisions: Decision[];
  private states: DecisionState[];
  private activeIndex: number;
  private theme: Theme;
  private cachedWidth?: number;
  private cachedLines?: string[];
  private title: Text;
  private colorFn: (s: string) => string;

  // Cached PickerList and Input instances per decision
  private pickerLists: (PickerList | undefined)[] = [];
  private inputFields: (Input | undefined)[] = [];
  // Per-decision focus mode
  private modes: ("select" | "input")[] = [];

  /** Callback invoked when all selections are submitted */
  public onSubmit?: (values: Record<string, string>) => void;
  /** Callback invoked when the form is cancelled */
  public onCancel?: () => void;
  /** Callback invoked when a render is requested */
  public onRequestRender?: () => void;

  constructor(title: string, decisions: Decision[], theme: Theme) {
    this.theme = theme;
    this.decisions = decisions;

    this.states = decisions.map(d => ({
      selectedValue: d.options[0]?.value ?? "",
      otherText: "",
    }));

    this.modes = decisions.map(() => "select");
    this.activeIndex = 0;

    this.container = new Container();
    this.colorFn = borderColor(isInReadMode());
    this.title = new Text(theme.fg("accent", theme.bold(title)), 1, 0);

    this.container.addChild(this.title);
    this.tabRow = new Container();
    this.container.addChild(this.tabRow);

    this.contentArea = new Container();
    this.container.addChild(this.contentArea);

    this.rebuildTabRow();
    this.rebuildContentOnly();
  }

  private rebuildContentOnly(): void {
    this.contentArea.clear();
    this.contentArea.addChild(new Spacer(1));
    this.buildDecisionContent();
    this.contentArea.addChild(new Spacer(1));
    const isLast = this.activeIndex === this.decisions.length - 1;
    const helpText = isLast
      ? "↑↓ navigate • enter submit all • tab ⭾ prev • esc cancel"
      : "↑↓ navigate • enter select • tab ⭾ switch • esc cancel";
    this.contentArea.addChild(new Text(this.theme.fg("dim", helpText), 1, 0));
  }

  private rebuildTabRow(): void {
    this.tabRow.clear();
    const parts: string[] = [];
    this.decisions.forEach((decision, index) => {
      const isActive = index === this.activeIndex;
      const tabText = decision.label;

      parts.push(isActive
        ? this.theme.fg("accent", `■ ${tabText} ■`)
        : this.theme.fg("dim", `  ${tabText}  `));
    });
    this.tabRow.addChild(new Text(parts.join(" "), 1, 0));
  }

  private buildDecisionContent(): void {
    const decision = this.decisions[this.activeIndex];
    const state = this.states[this.activeIndex];

    if (decision.tooltip) {
      this.contentArea.addChild(new Text(this.theme.fg("dim", decision.tooltip), 1, 0));
    }

    // Reuse or create picker list
    let pickerList = this.pickerLists[this.activeIndex];
    if (!pickerList) {
      pickerList = this.buildPickerList(decision);
      this.pickerLists[this.activeIndex] = pickerList;
    }
    // Placeholder — PickerList renders outside the container

    // Always create/cache Input field
    let inputField = this.inputFields[this.activeIndex];
    if (!inputField) {
      inputField = new Input();
      this.inputFields[this.activeIndex] = inputField;
    }
    inputField.setValue(state.otherText);
    // Only add to container in input mode — avoids "null" rendering in select mode
    if (this.modes[this.activeIndex] === "input") {
      this.contentArea.addChild(inputField);
    }
  }

  private buildPickerList(decision: Decision): PickerList {
    const items: PickerItem[] = decision.options.map(o => ({
      value: o.value,
      label: o.label,
      description: o.description,
    }));

    const otherLabel = (decision.otherLabel && decision.otherLabel.length > 0)
      ? decision.otherLabel : "Something else...";
    items.push({ value: OTHER_VALUE, label: otherLabel });

    const list = new PickerList(items, this.theme);

    list.onSelect = (item) => {
      const state = this.states[this.activeIndex];
      if (item.value === OTHER_VALUE) {
        this.modes[this.activeIndex] = "input";
        state.selectedValue = OTHER_VALUE;
      } else {
        state.selectedValue = item.value;
        state.otherText = "";
      }
    };

    list.onCancel = () => {
      this.onCancel?.();
    };

    return list;
  }

  private navigateTab(direction: number): void {
    this.activeIndex = (this.activeIndex + direction + this.decisions.length) % this.decisions.length;
    this.rebuildTabRow();
    this.rebuildContentOnly();
    this.invalidate();
    this.onRequestRender?.();
  }

  private submit(): void {
    const values: Record<string, string> = {};
    this.decisions.forEach((decision, index) => {
      const state = this.states[index];
      if (state.otherText.length > 0) {
        values[decision.label] = state.otherText;
      } else if (state.selectedValue === OTHER_VALUE) {
        values[decision.label] = "";
      } else {
        values[decision.label] = state.selectedValue;
      }
    });
    this.onSubmit?.(values);
  }

  handleInput(data: string): void {
    const mode = this.modes[this.activeIndex];

    if (matchesKey(data, Key.tab)) { this.navigateTab(1); return; }
    if (matchesKey(data, Key.shift(Key.tab))) { this.navigateTab(-1); return; }

    if (mode === "select") {
      const pickerList = this.pickerLists[this.activeIndex];
      if (matchesKey(data, Key.escape)) { this.onCancel?.(); return; }

      const wasInputBefore = this.modes[this.activeIndex] === "input";

      pickerList!.handleInput(data);
      this.invalidate();
      this.onRequestRender?.();

      if (matchesKey(data, Key.enter)) {
        if (wasInputBefore) {
          if (this.activeIndex === this.decisions.length - 1) {
            this.submit();
          } else {
            this.navigateTab(1);
          }
        } else if (this.modes[this.activeIndex] === "input") {
          this.rebuildContentOnly();
          this.rebuildTabRow();
          this.invalidate();
          this.onRequestRender?.();
        } else if (this.activeIndex === this.decisions.length - 1) {
          this.submit();
        } else {
          this.navigateTab(1);
        }
      }
    } else {
      const inputField = this.inputFields[this.activeIndex];
      const state = this.states[this.activeIndex];

      if (matchesKey(data, Key.escape)) {
        this.modes[this.activeIndex] = "select";
        state.otherText = "";
        inputField!.setValue("");
        this.rebuildTabRow();
        this.rebuildContentOnly();
        this.invalidate();
        this.onRequestRender?.();
        return;
      }

      if (matchesKey(data, Key.enter)) {
        if (this.activeIndex === this.decisions.length - 1) {
          this.submit();
        } else {
          this.navigateTab(1);
        }
        return;
      }

      inputField!.handleInput(data);
      state.otherText = inputField!.getValue();
      this.rebuildTabRow();
      this.rebuildContentOnly();
      this.invalidate();
      this.onRequestRender?.();
    }
  }

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) {
      return this.cachedLines;
    }

    const lines: string[] = [];

    // Title
    lines.push(this.title.render(width)[0]!);

    // Tab row
    lines.push(this.tabRow.render(width)[0]!);

    // Spacer
    lines.push("");

    if (this.modes[this.activeIndex] === "select") {
      // Tooltip (optional)
      const decision = this.decisions[this.activeIndex];
      if (decision?.tooltip && typeof decision.tooltip === "string" && decision.tooltip.length > 0) {
        lines.push(this.theme.fg("dim", "  " + decision.tooltip));
      }

      // PickerList items
      const pickerList = this.pickerLists[this.activeIndex];
      if (pickerList) {
        lines.push(...pickerList.render(width));
      }
    } else {
      // Input mode — render Input field
      const inputField = this.inputFields[this.activeIndex];
      if (inputField) {
        lines.push(inputField.render(width)[0] || "");
      }
    }

    // Spacer + help + border
    lines.push("");
    const isLast = this.activeIndex === this.decisions.length - 1;
    lines.push(this.theme.fg("dim", isLast
      ? " ↑↓ navigate • enter submit all • tab next • esc cancel"
      : " ↑↓ navigate • enter select • tab next • esc cancel"));

    // Wrap with thick border lines
    const borderLine = this.colorFn(BORDER_CHAR.repeat(width));
    this.cachedLines = [borderLine, ...lines.map((l) => truncateToWidth(l, width)), borderLine];
    this.cachedWidth = width;
    return this.cachedLines;
  }

  invalidate(): void {
    this.cachedWidth = undefined;
    this.cachedLines = undefined;
    this.pickerLists.forEach(l => l?.invalidate());
    this.container.invalidate();
  }
}
