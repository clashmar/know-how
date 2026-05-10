/**
 * Read/Write Mode Extension
 *
 * Role-based read/write gating for subagents. Read-only roles
 * (scout, reviewer, guardian) permanently locked to read mode.
 * Write-capable roles (worker, maester) start in write mode.
 * Main (human) sessions default to read mode with toggle.
 */

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { ModeAwareEditor } from "./mode-editor";

// ── Bash allowlist ──────────────────────────────────────────────────

const DESTRUCTIVE_PATTERNS = [
  /\brm\b/i,
  /\brmdir\b/i,
  /\bmv\b/i,
  /\bcp\b/i,
  /\bmkdir\b/i,
  /\btouch\b/i,
  /\bchmod\b/i,
  /\bchown\b/i,
  /\bchgrp\b/i,
  /\bln\b/i,
  /\btee\b/i,
  /\btruncate\b/i,
  /\bdd\b/i,
  /\bshred\b/i,
  /(^|[^<])>(?!>)/,
  />>/,
  /\bnpm\s+(install|uninstall|update|ci|link|publish)/i,
  /\byarn\s+(add|remove|install|publish)/i,
  /\bpnpm\s+(add|remove|install|publish)/i,
  /\bpip\s+(install|uninstall)/i,
  /\bapt(-get)?\s+(install|remove|purge|update|upgrade)/i,
  /\bbrew\s+(install|uninstall|upgrade)/i,
  /\bgit\s+(add|commit|push|pull|merge|rebase|reset|checkout|branch\s+-[dD]|stash|cherry-pick|revert|tag|init|clone|remote\s+add|remote\s+set-url)/i,
  /\bsudo\b/i,
  /\bsu\b/i,
  /\bkill\b/i,
  /\bpkill\b/i,
  /\bkillall\b/i,
  /\breboot\b/i,
  /\bshutdown\b/i,
  /\bsystemctl\s+(start|stop|restart|enable|disable)/i,
  /\bservice\s+\S+\s+(start|stop|restart)/i,
  /\b(vim?|nano|emacs|code|subl)\b/i,
  /\bcargo\s+(install|uninstall|publish|update|vendor|package|yank)/i,
  /\brustup\s+(install|update|uninstall|target\s+add|component\s+add)/i,
];

const SAFE_PATTERNS = [
  /^\s*cat\b/,
  /^\s*head\b/,
  /^\s*tail\b/,
  /^\s*less\b/,
  /^\s*more\b/,
  /^\s*grep\b/,
  /^\s*find\b/,
  /^\s*rg\b/,
  /^\s*fd\b/,
  /^\s*bat\b/,
  /^\s*eza\b/,
  /^\s*ls\b/,
  /^\s*pwd\b/,
  /^\s*echo\b/,
  /^\s*printf\b/,
  /^\s*wc\b/,
  /^\s*sort\b/,
  /^\s*uniq\b/,
  /^\s*diff\b/,
  /^\s*file\b/,
  /^\s*stat\b/,
  /^\s*du\b/,
  /^\s*df\b/,
  /^\s*tree\b/,
  /^\s*which\b/,
  /^\s*whereis\b/,
  /^\s*type\b/,
  /^\s*env\b/,
  /^\s*printenv\b/,
  /^\s*uname\b/,
  /^\s*whoami\b/,
  /^\s*id\b/,
  /^\s*date\b/,
  /^\s*cal\b/,
  /^\s*uptime\b/,
  /^\s*ps\b/,
  /^\s*top\b/,
  /^\s*htop\b/,
  /^\s*free\b/,
  /^\s*git\s+(status|log|diff|show|branch|remote|config\s+--get|stash\s+list|reflog|blame|grep|ls-tree|ls-files|ls-remote|rev-parse|rev-list|describe|tag\s+-l|worktree\s+list)/i,
  /^\s*git\s+ls-/i,
  /^\s*gh\s+(run|pr|issue|repo|auth\s+status|status)/i,
  /^\s*npm\s+(list|ls|view|info|search|outdated|audit|config\s+list|root|bin|prefix)/i,
  /^\s*yarn\s+(list|info|why|audit|config)/i,
  /^\s*node\s+--version/i,
  /^\s*python\s+--version/i,
  /^\s*python3\s+--version/i,
  /^\s*cargo\s+check\b/i,
  /^\s*cargo\s+clippy\b/i,
  /^\s*cargo\s+build\b/i,
  /^\s*cargo\s+test\b/i,
  /^\s*cargo\s+doc\b/i,
  /^\s*cargo\s+bench\b/i,
  /^\s*cargo\s+fmt\s+--\s*--check/i,
  /^\s*cargo\s+fmt\s+--check/i,
  /^\s*cargo\s+tree\b/i,
  /^\s*cargo\s+metadata\b/i,
  /^\s*cargo\s+loc\b/i,
  /^\s*cargo\s+readme\b/i,
  /^\s*cargo\s+audit\b/i,
  /^\s*cargo\s+outdated\b/i,
  /^\s*cargo\s+udeps\b/i,
  /^\s*cargo\s+modules\b/i,
  /^\s*cargo\s+workspace\b/i,
  /^\s*rustup\s+(show|check|which|doc|component\s+list|target\s+list|toolchain\s+list)/i,
  /^\s*rustc\s+--version/i,
  /^\s*rustdoc\b/i,
  /^\s*curl\s/i,
  /^\s*wget\s+-O\s*-/i,
  /^\s*jq\b/,
  /^\s*sed\s+-n/i,
  /^\s*awk\b/,
  /\btrue\b/,
  /\bfalse\b/,
];

function isSafeCommand(command: string): boolean {
  const isDestructive = DESTRUCTIVE_PATTERNS.some((p) => p.test(command));
  const isSafe = SAFE_PATTERNS.some((p) => p.test(command));
  return !isDestructive && isSafe;
}

// ── Read-only tool set ──────────────────────────────────────────────

const READ_MODE_TOOLS = [
  "read", "bash", "grep", "find", "ls",
  "lsp_navigation", "ast_grep_search",
  "memory_search",
  "set_context", "monitor_pipeline", "stop_monitor",
  "subagent",
  "jira_ticket", "jira_create_subtask",
  "todo", "set_session_goal",
];

// ── Role sets ───────────────────────────────────────────────────────
// Read-only roles permanently locked to read mode. Write-capable start in write.
const READ_ONLY_ROLES = new Set(["scout", "reviewer", "guardian"]);
const WRITE_CAPABLE_ROLES = new Set(["worker", "maester"]);

// Editor reference — updated on toggle
let modeEditor: ModeAwareEditor | undefined;

// ── Extension ───────────────────────────────────────────────────────

export function registerReadMode(pi: ExtensionAPI): void {
  let readModeEnabled = true;
  let agentRole: string | undefined;
  let roleLocked = false;

  function getAllToolNames(): string[] {
    return pi.getAllTools().map((t) => t.name);
  }

  function updateStatus(): void {
    modeEditor?.setMode(readModeEnabled, roleLocked, agentRole);
  }

  function persistState(): void {
    pi.appendEntry("read-mode", { enabled: readModeEnabled });
  }

  function enterReadMode(ctx: ExtensionContext): void {
    if (readModeEnabled) return;
    readModeEnabled = true;
    pi.setActiveTools(READ_MODE_TOOLS);
    ctx.ui.notify("Read mode — write/edit disabled.", "info");
    updateStatus();
    persistState();
  }

  function enterWriteMode(ctx: ExtensionContext): void {
    if (roleLocked) {
      ctx.ui.notify("Write mode blocked: this agent role is permanently read-only.", "warning");
      return;
    }
    if (!readModeEnabled) return;
    readModeEnabled = false;
    pi.setActiveTools(getAllToolNames());
    ctx.ui.notify("Write mode — full access restored.", "info");
    updateStatus();
    persistState();
  }

  function toggleMode(ctx: ExtensionContext): void {
    if (roleLocked) {
      enterReadMode(ctx);
      ctx.ui.notify("Write mode blocked: this agent role is permanently read-only.", "warning");
      return;
    }
    if (readModeEnabled) {
      enterWriteMode(ctx);
    } else {
      enterReadMode(ctx);
    }
  }

  pi.registerCommand("read", {
    description: "Enter read mode (write/edit disabled)",
    handler: async (_args, ctx) => enterReadMode(ctx),
  });

  pi.registerCommand("write", {
    description: "Enter write mode (full read+write access)",
    handler: async (_args, ctx) => enterWriteMode(ctx),
  });

  pi.registerShortcut("ctrl+/", {
    description: "Toggle read/write mode",
    handler: async (ctx) => toggleMode(ctx),
  });

  pi.on("before_agent_start", async (event, ctx) => {
    updateStatus();

    if (roleLocked) {
      return {
        message: { customType: "read-mode-context", content: "[Read mode — role-locked]", display: false },
        systemPrompt:
          event.systemPrompt +
          `\n\n🔒 READ MODE ACTIVE (ROLE-LOCKED). You are ${agentRole} — permanently read-only. No write access. Report findings as text.`,
      };
    }

    if (readModeEnabled) {
      return {
        message: { customType: "read-mode-context", content: "[Read mode — write/edit blocked]", display: false },
        systemPrompt:
          event.systemPrompt +
          "\n\n⚠️ READ MODE ACTIVE. You cannot write files. Dispatch scouts and reviewers freely. Do NOT dispatch workers — run /write first.",
      };
    }

    return {
      message: { customType: "read-mode-context", content: "[Write mode — full access]", display: false },
    };
  });

  // ── Bash gate — block destructive commands in read mode ───────

  pi.on("tool_call", async (event) => {
    if (!readModeEnabled || event.toolName !== "bash") return;

    const command = event.input.command as string;
    if (!isSafeCommand(command)) {
      const roleInfo = roleLocked ? ` (role-locked as ${agentRole})` : "";
      return {
        block: true,
        reason:
          `Read mode: command blocked (read-only only)${roleInfo}. Use /write to switch to write mode.\n` +
          `Blocked command: ${command}`,
      };
    }
  });

  // ── Session lifecycle ───────────────────────────────────────────

  pi.on("session_start", async (_event, ctx) => {
    const isSubagent = process.env.PI_SUBAGENT_CHILD === "1";
    agentRole = process.env.PI_SUBAGENT_CHILD_AGENT || undefined;

    if (isSubagent && agentRole && READ_ONLY_ROLES.has(agentRole)) {
      roleLocked = true;
      readModeEnabled = true;
      pi.setActiveTools(READ_MODE_TOOLS);
    } else if (isSubagent && agentRole && WRITE_CAPABLE_ROLES.has(agentRole)) {
      roleLocked = false;
      readModeEnabled = false;
      pi.setActiveTools(getAllToolNames());
    } else {
      roleLocked = false;
      readModeEnabled = true;
      pi.setActiveTools(READ_MODE_TOOLS);
    }

    updateStatus();
    persistState();

    ctx.ui.setEditorComponent((tui, theme, kb) => {
      const editor = new ModeAwareEditor(tui, theme, kb);
      modeEditor = editor;
      editor.setMode(readModeEnabled, roleLocked, agentRole);
      return editor;
    });
  });
}
