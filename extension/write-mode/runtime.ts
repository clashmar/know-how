import type { ExtensionContext } from "@mariozechner/pi-coding-agent";

/** Callback that immediately switches the current session into write mode. */
export type ApprovedWriteModeActivator = (ctx: ExtensionContext) => void;

let approvedWriteModeActivator: ApprovedWriteModeActivator | undefined;

/** Registers the runtime callback used after write-mode approval is already granted. */
export function registerApprovedWriteModeActivator(activator: ApprovedWriteModeActivator): void {
  approvedWriteModeActivator = activator;
}

/** Immediately enables write mode when an approval-bearing prompt already received consent. */
export function activateApprovedWriteMode(ctx: ExtensionContext): boolean {
  if (!approvedWriteModeActivator) {
    return false;
  }

  approvedWriteModeActivator(ctx);
  return true;
}
