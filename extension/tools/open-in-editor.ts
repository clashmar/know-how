import { Type } from "@sinclair/typebox";
import { Text } from "@earendil-works/pi-tui";
import { spawnSync, execFileSync } from "child_process";
// @mariozechner/pi-coding-agent is deprecated upstream; will migrate when @samfp/pi-memory updates
import type { ExtensionAPI, AgentToolResult } from "@mariozechner/pi-coding-agent";
import { readSettings } from "../settings";
import { resolveEditorCommand, EDITOR_PRIORITY } from "./resolve-editor-command";

/** Returns editor CLI names from EDITOR_PRIORITY that exist in PATH. */
export function detectAvailableEditors(): string[] {
  const whichCmd = process.platform === "win32" ? "where" : "which";
  const found: string[] = [];
  for (const editor of EDITOR_PRIORITY) {
    try {
      execFileSync(whichCmd, [editor], { stdio: "pipe" });
      found.push(editor);
    } catch {
      // not in PATH — skip
    }
  }
  return found;
}

/** Registers the open_in_editor tool with the pi agent. */
export function registerOpenInEditor(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "open_in_editor",
    label: "Open in editor",
    description:
      "Opens the current working directory in the user's preferred code editor. " +
      "Reads knowHow.openCommand from ~/.pi/agent/settings.json if set. " +
      "Falls back to auto-detecting installed editors (VS Code, Cursor, Zed, " +
      "Sublime Text, PHPStorm, IntelliJ IDEA, WebStorm, GoLand, PyCharm, CLion, " +
      "RubyMine, Rider, DataGrip), then to the OS default (open/xdg-open/start).",
    parameters: Type.Object({}),
    renderCall(_args, theme) {
      return new Text(
        `${theme.fg("toolTitle", theme.bold("open_in_editor"))} ${theme.fg("dim", "· opening project")}`,
        0, 0,
      );
    },
    async execute(_toolCallId, _params, _signal, _onUpdate, ctx): Promise<AgentToolResult<unknown>> {
      const settings = readSettings();
      const openCommand = settings.knowHow?.openCommand;
      const available = detectAvailableEditors();
      const { command, tip } = resolveEditorCommand(openCommand, available, process.platform);
      const cwd = ctx.cwd;
      if (!cwd) {
        return {
          content: [{ type: "text", text: "Cannot open editor: session CWD is not set." }],
          details: {},
        };
      }

      const result = spawnSync(command, [], {
        cwd,
        stdio: "pipe",
        shell: true,
      });

      if (result.error || result.status !== 0) {
        const stderrText = result.stderr?.toString().trim() ?? "";
        const errorMsg = stderrText.length > 0 ? stderrText : (result.error?.message ?? "unknown error");
        return {
          content: [{ type: "text", text: `Failed to open ${cwd}: ${errorMsg}` }],
          details: {},
        };
      }

      const lines = [`Opened ${cwd} with: ${command}`];
      if (tip) lines.push(tip);
      return {
        content: [{ type: "text", text: lines.join("\n") }],
        details: {},
      };
    },
  });
}
