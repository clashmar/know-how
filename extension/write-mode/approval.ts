/**
 * Write-Mode Approval Helper
 *
 * Reusable controller-side helper for write-mode approval prompts.
 * Provides structured outcomes for approve, decline, free-text defer,
 * and role-locked cases.
 */

import {
  CANCELLED_SENTINEL,
  ENABLE_WRITE_MODE_VALUE,
  STAY_READ_MODE_VALUE,
} from "./signals";

// ── Constants ───────────────────────────────────────────────────────

export {
  ENABLE_WRITE_MODE_VALUE,
  STAY_READ_MODE_VALUE,
} from "./signals";

// ── Types ───────────────────────────────────────────────────────────

/** Result of attempting to transition to write mode. */
export type WriteModeTransitionResult = "enabled" | "already-write" | "role-locked" | "declined" | "deferred";

/** Structured outcome from a write-mode approval flow. */
export type WriteModeApprovalOutcome =
  | { result: "enabled" }
  | { result: "already-write" }
  | { result: "declined" }
  | { result: "deferred"; note: string }
  | { result: "role-locked" };

/** Dependencies required by ensureWriteModeForAction. */
export interface WriteModeApprovalDeps {
  /** Returns true if currently in read mode. */
  isReadMode(): boolean;
  /** Returns true if the current role is permanently read-only. */
  isRoleLocked(): boolean;
  /** Switches from read to write mode. */
  enableWriteMode(): void;
  /** Shows a choice picker; returns the selected value or null on cancel. */
  presentChoice(params: {
    title: string;
    options: { label: string; value: string; description?: string }[];
  }): Promise<string | null>;
}

/** Input parameters for a write-mode approval request. */
export interface WriteModeApprovalRequest {
  /** Dialog title for the choice picker. */
  title: string;
  /** Label for the "enable write mode" button/option. */
  actionLabel: string;
  /** Reason why write mode is needed (logged/shown for context). */
  reason: string;
}

// ── Core logic ──────────────────────────────────────────────────────

/**
 * Prompts the user for write-mode approval if needed.
 *
 * Flow:
 * 1. If already in write mode, returns `already-write` immediately.
 * 2. If the role is locked to read-only, returns `role-locked` immediately.
 * 3. Otherwise, shows a choice: enable write mode, stay in read mode, or provide free-text deferral.
 * 4. Cancellation is treated as declined.
 */
export async function ensureWriteModeForAction(
  deps: WriteModeApprovalDeps,
  request: WriteModeApprovalRequest,
): Promise<WriteModeApprovalOutcome> {
  // Already in write mode — no prompt needed.
  if (!deps.isReadMode()) {
    return { result: "already-write" };
  }

  // Role-locked — can't ever switch to write mode.
  if (deps.isRoleLocked()) {
    return { result: "role-locked" };
  }

  // Show the choice picker: enable write mode, stay in read mode, or free-text deferral.
  // The picker auto-appends a "Something else..." option for free-text input.
  const choice = await deps.presentChoice({
    title: request.title,
    options: [
      { label: request.actionLabel, value: ENABLE_WRITE_MODE_VALUE, description: request.reason },
      { label: "Stay in read mode", value: STAY_READ_MODE_VALUE },
    ],
  });

  // Cancellation (null or CANCELLED_SENTINEL) → declined.
  if (choice === null || choice === CANCELLED_SENTINEL) {
    return { result: "declined" };
  }

  // User chose to enable write mode.
  if (choice === ENABLE_WRITE_MODE_VALUE) {
    deps.enableWriteMode();
    return { result: "enabled" };
  }

  // User chose to stay in read mode.
  if (choice === STAY_READ_MODE_VALUE) {
    return { result: "declined" };
  }

  // User typed free-text deferral note.
  return { result: "deferred", note: choice };
}
