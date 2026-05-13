/** Border character used by the mode-aware editor and picker overlays. */
export const BORDER_CHAR = "━";

/** Returns a border color function based on read/write mode. */
export function borderColor(isReadMode: boolean): (s: string) => string {
  return isReadMode
    ? (s: string) => `\x1b[34m${s}\x1b[0m`
    : (s: string) => `\x1b[32m${s}\x1b[0m`;
}
