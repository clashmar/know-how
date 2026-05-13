import { matchesKey, Key, Text, Input, Container, Spacer, truncateToWidth } from "@earendil-works/pi-tui";
import type { Theme } from "@mariozechner/pi-coding-agent";
import { isInReadMode } from "../read-mode";
import { borderColor, BORDER_CHAR } from "./border-style";
import { PickerList } from "./picker-list";
import type { PickerItem } from "./picker-list";

/** An option in the choice picker. */
export interface ChoiceOption {
  label: string;
  description?: string;
  value?: string;
}

export const Mode = { List: "list" as const, Input: "input" as const };
type ModeType = (typeof Mode)[keyof typeof Mode];

export const OTHER_VALUE = "__other__";

export class ChoicePicker {
  private container: Container;
  private pickerList: PickerList;
  private inputField?: Input;
  private mode: ModeType = Mode.List;
  private otherLabel: string;
  private cachedWidth?: number;
  private cachedLines?: string[];
  private theme: Theme;
  private title: Text;
  private colorFn: (s: string) => string;

  public onSelect?: (value: string) => void;
  public onCancel?: () => void;
  public onRequestRender?: () => void;

  constructor(title: string, options: ChoiceOption[], theme: Theme, otherLabel?: string | null) {
    this.theme = theme;
    this.otherLabel = otherLabel || "Something else...";
    this.colorFn = borderColor(isInReadMode());

    this.container = new Container();
    this.title = new Text(theme.fg("accent", theme.bold(title)), 1, 0);
    this.container.addChild(this.title);
    this.container.addChild(new Spacer(1));

    this.pickerList = this.buildPickerList(options);

    this.container.addChild(new Spacer(1));
    this.container.addChild(new Text(theme.fg("dim", "↑↓ navigate • enter select • esc cancel"), 1, 0));
  }

  private buildPickerList(options: ChoiceOption[]): PickerList {
    const items: PickerItem[] = options.map(o => ({
      value: o.value ?? o.label,
      label: o.label,
      description: o.description,
    }));
    items.push({ value: OTHER_VALUE, label: this.otherLabel });

    const list = new PickerList(items, this.theme);
    list.onSelect = (item) => {
      if (item.value === OTHER_VALUE) this.switchToInput();
      else this.onSelect?.(item.value);
    };
    list.onCancel = () => this.onCancel?.();
    return list;
  }

  private switchToInput(): void {
    this.mode = Mode.Input;
    this.inputField = new Input();
    this.rebuildContainer();
    this.invalidate();
    this.onRequestRender?.();
  }

  private rebuildContainer(): void {
    this.container.clear();
    this.container.addChild(this.title);
    this.container.addChild(new Spacer(1));

    if (this.mode === Mode.List) {
      this.container.addChild(new Text("", 0, 0));
    } else {
      this.container.addChild(this.inputField!);
    }

    this.container.addChild(new Spacer(1));
    const help = this.mode === Mode.List
      ? new Text(this.theme.fg("dim", "↑↓ navigate • enter select • esc cancel"), 1, 0)
      : new Text(this.theme.fg("dim", "enter confirm • esc back to list"), 1, 0);
    this.container.addChild(help);
  }

  handleInput(data: string): void {
    if (this.mode === Mode.List) {
      if (matchesKey(data, Key.escape)) { this.onCancel?.(); return; }
      this.pickerList.handleInput(data);
      this.invalidate();
      this.onRequestRender?.();
      return;
    }
    if (matchesKey(data, Key.escape)) {
      this.mode = Mode.List;
      this.inputField = undefined;
      this.rebuildContainer();
      this.invalidate();
      this.onRequestRender?.();
      return;
    }
    if (matchesKey(data, Key.enter)) {
      this.onSelect?.(this.inputField!.getValue());
      return;
    }
    this.inputField!.handleInput(data);
    this.invalidate();
    this.onRequestRender?.();
  }

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) return this.cachedLines;

    const borderLine = this.colorFn(BORDER_CHAR.repeat(width));

    if (this.mode === Mode.List) {
      const listLines = this.pickerList.render(width);
      const containerLines = this.container.render(width);
      const insertAt = 2;
      const before = containerLines.slice(0, insertAt);
      const after = containerLines.slice(insertAt);
      this.cachedLines = [borderLine, ...before, ...listLines, ...after, borderLine];
    } else {
      const inner = this.container.render(width);
      this.cachedLines = [borderLine, ...inner, borderLine];
    }

    this.cachedWidth = width;
    return this.cachedLines.map(l => truncateToWidth(l, width));
  }

  invalidate(): void {
    this.cachedWidth = undefined;
    this.cachedLines = undefined;
    this.pickerList.invalidate();
    this.container.invalidate();
  }
}
