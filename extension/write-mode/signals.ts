/** Canonical sentinel emitted when a choice prompt is cancelled. */
export const CANCELLED_SENTINEL = "(cancelled)";

/** Canonical value for selecting immediate write-mode enablement. */
export const ENABLE_WRITE_MODE_VALUE = "__enable-write-mode__";

/** Canonical value for explicitly staying in read mode. */
export const STAY_READ_MODE_VALUE = "__stay-read-mode__";

const ENABLE_WRITE_MODE_SELECTIONS = new Set([
  normalizeWriteModeSelection(ENABLE_WRITE_MODE_VALUE),
  normalizeWriteModeSelection("enable"),
  normalizeWriteModeSelection("enable-write"),
  normalizeWriteModeSelection("enable write mode"),
  normalizeWriteModeSelection("switch-write"),
  normalizeWriteModeSelection("switch to write mode"),
  normalizeWriteModeSelection("__write_mode_enable__"),
]);

function normalizeWriteModeSelection(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** Returns true when a picker selection should immediately enable write mode. */
export function isWriteModeEnableSelection(value: string): boolean {
  return ENABLE_WRITE_MODE_SELECTIONS.has(normalizeWriteModeSelection(value));
}
