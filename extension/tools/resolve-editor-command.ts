/** Priority-ordered list of editor CLI names to detect in PATH. */
export const EDITOR_PRIORITY = [
  "code",
  "cursor",
  "zed",
  "subl",
  "phpstorm",
  "idea",
  "webstorm",
  "goland",
  "pycharm",
  "clion",
  "rubymine",
  "rider",
  "datagrip",
] as const;

/** Resolved command and optional fallback guidance for opening the editor. */
export type ResolveResult = {
  /** Shell command to run in the CWD. */
  command: string;
  /** Hint to show when falling back to OS default. */
  tip?: string;
};

type SupportedPlatform = "darwin" | "linux" | "win32";

/** Maps process.platform values to the OS-default command for opening a directory. */
export const OS_FALLBACK: Record<SupportedPlatform, string> = {
  darwin: "open .",
  linux: "xdg-open .",
  win32: "start .",
};

const CONFIGURE_TIP =
  'Tip: set knowHow.openCommand to "code ." (or your editor\'s CLI) in ~/.pi/agent/settings.json for a better experience.';

/**
 * Resolves which command to use to open a project directory.
 *
 * @param openCommand - Value of knowHow.openCommand from settings, if set.
 * @param availableEditors - Editor CLI names found in PATH (caller supplies these).
 * @param platform - process.platform value ("darwin" | "linux" | "win32").
 */
export function resolveEditorCommand(
  openCommand: string | undefined,
  availableEditors: string[],
  platform: string,
): ResolveResult {
  if (openCommand !== undefined && openCommand.trim().length > 0) {
    return { command: openCommand };
  }

  for (const editor of EDITOR_PRIORITY) {
    if (availableEditors.includes(editor)) {
      return { command: `${editor} .` };
    }
  }

  const fallback = OS_FALLBACK[platform as SupportedPlatform] ?? OS_FALLBACK.darwin;
  return { command: fallback, tip: CONFIGURE_TIP };
}
