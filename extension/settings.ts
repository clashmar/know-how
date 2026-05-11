import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// ── Types ────────────────────────────────────────────────────────

export interface SubagentConfig {
  model?: string;
  fallbackModels?: string[];
  thinkingLevel?: string;
}

export interface KnowHowConfig {
  subagents?: Record<string, SubagentConfig>;
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
