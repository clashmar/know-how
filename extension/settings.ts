import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// ── Types ────────────────────────────────────────────────────────

export interface SubagentConfig {
  model?: string;
  fallbackModels?: string[];
  thinkingLevel?: string;
}

/** Tool names that pi core registers as write-capable. */
export const DEFAULT_READ_MODE_BLACKLIST: readonly string[] = ["edit", "write"];

export interface ReadModeConfig {
  /** Additional tool names to block in read mode. Default blacklist (edit, write) is always applied. */
  toolBlacklist?: string[];
}

export interface KnowHowConfig {
  subagents?: Record<string, SubagentConfig>;
  /** Shell command to open a directory in the user's preferred editor, e.g. "code .", "phpstorm ." */
  openCommand?: string;
  readMode?: ReadModeConfig;
}

export interface Settings {
  defaultProvider?: string;
  defaultModel?: string;
  defaultThinkingLevel?: string;
  knowHow?: KnowHowConfig;
}

// ── Reading ──────────────────────────────────────────────────────

const SETTINGS_PATH = path.join(os.homedir(), ".pi", "agent", "settings.json");

/** Reads the pi agent settings from ~/.pi/agent/settings.json. */
export function readSettings(): Settings {
  try {
    const raw: unknown = JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf-8"));
    return raw as Settings;
  } catch {
    return {};
  }
}

/** Returns the effective read-mode tool blacklist: default write tools + user config. */
export function getReadModeToolBlacklist(): readonly string[] {
  const settings = readSettings();
  const userBlacklist = settings.knowHow?.readMode?.toolBlacklist ?? [];
  return [...DEFAULT_READ_MODE_BLACKLIST, ...userBlacklist];
}
