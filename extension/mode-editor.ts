/**
 * ModeAwareEditor — custom editor that changes appearance based on read/write mode.
 *
 * - Read mode / role-locked: blue foreground border (matching the widget badge's background)
 * - Write mode: green foreground border
 * - Thick horizontal box-drawing characters (━ instead of ─)
 * - No side borders, no background fills, no extra padding
 */

import { CustomEditor } from "@mariozechner/pi-coding-agent";
import { borderColor, BORDER_CHAR } from "./ui/border-style";

const ANSI_RE = /\x1b\[\d+(;\d+)*m/g;

type EditorMode = "read" | "write" | "locked";

export class ModeAwareEditor extends CustomEditor {
  private editorMode: EditorMode = "read";

  setMode(readMode: boolean, locked: boolean, _role?: string): void {
    this.editorMode = locked ? "locked" : readMode ? "read" : "write";
    this.tui?.requestRender();
  }

  render(width: number): string[] {
    this.borderColor = borderColor(this.editorMode !== "write");

    this.setPaddingX(1);

    const lines = super.render(width);
    if (lines.length === 0) return lines;

    // Find bottom border — scan from end for a line whose plain text starts with ─
    let bottomBorderIdx = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
      const plain = lines[i].replace(ANSI_RE, "");
      if (plain.startsWith("─")) {
        bottomBorderIdx = i;
        break;
      }
    }
    if (bottomBorderIdx === -1) bottomBorderIdx = lines.length - 1;

    const color = this.borderColor;

    const result: string[] = [];

    // Top border — mode label left-aligned
    const modeLabelText = this.editorMode === "write" ? " WRITE " : " READ ";
    const labelLen = modeLabelText.length;
    const leftLen = 2;
    const rightLen = Math.max(0, width - leftLen - labelLen);
    result.push(color(BORDER_CHAR.repeat(leftLen)) + color(modeLabelText) + color(BORDER_CHAR.repeat(rightLen)));

    // Content lines (between top and bottom borders)
    for (let i = 1; i < bottomBorderIdx; i++) {
      result.push(lines[i]);
    }

    // Bottom border — thick line
    result.push(color(BORDER_CHAR).repeat(width));

    // Autocomplete lines (after bottom border, if any)
    for (let i = bottomBorderIdx + 1; i < lines.length; i++) {
      result.push(lines[i]);
    }

    return result;
  }
}
