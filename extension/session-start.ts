/**
 * Session-start content injection.
 *
 * Injects global workflow rules (parallel exploration, no agent artifacts,
 * MAX 3 subagents) into every pi session on start.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const SESSION_START_CONTENT = `<WORKFLOW_CONVENTIONS>
## Parallel Exploration (MANDATORY — never explore sequentially)

**When exploring a codebase, getting up to speed on a project, or gathering
context — ALWAYS dispatch EXACTLY TWO parallel scouts instead of reading
files sequentially. This is not a preference. Sequential file exploration
wastes turns, pollutes context, and is slower by an order of magnitude.**

This applies to:

- **Getting up to speed on a codebase** before implementing — dispatch \`scout\`
  subagents with specific files and questions, then read only what you actually need
- **Reading multiple source files** to understand a subsystem — dispatch parallel
  \`scout\` subagents, one per area, with bounded file lists
- **Checking tests, configs, and docs** for related context — dispatch in
  parallel, gather results, then act
- **Any situation where you're about to \`read\` 3+ files sequentially** —
  stop and dispatch instead

**Exception:** Reading a single file that you already know you need (e.g., the
plan file, a specific source file named in the task). Single targeted reads
are fine. It's the sequential exploration chain that's the problem.

⚠️ **MAX 3 CONCURRENT SUBAGENTS** — Never dispatch more than 3 subagents at
once. If more are needed, wait for earlier ones to complete first. This
applies globally, not per-skill.

## Agent-Generated Artifacts

**NEVER** write agent-oriented files into a project repo unless explicitly
asked. This includes specs, plans, design documents, progress files, context
files, scratch pads, agentic instructions (AGENTS.md, skills, workflows,
prompts), brainstorming outputs, review artifacts, and meta-documentation.

These are personal workflow artifacts — committing them forces your preferences
on every contributor and clutters the repo for people with different tools.

### Subagents and File Writes

- **Scouts and reviewers** report findings as response text — not files.
- **Workers** write code changes (source files, tests, configs) but must not
  write agent clutter (progress files, scratch pads, meta-docs) into the repo.
- **Progress tracking** is done via the \`todo\` tool, not \`progress.md\`.
- **Context gathering** is done by reading files and reporting findings in
  response text, not by writing summary files into the repo.
</WORKFLOW_CONVENTIONS>`;

const CONTENT_TYPE = "know-how-conventions";

/**
 * Registers a before_agent_start hook that injects workflow rules at the
 * start of every session. Skips subagent sessions (parent already has them)
 * and prevents double-injection within the same session.
 */
export function beforeAgentStart(pi: ExtensionAPI): void {
	const isSubagent = process.env.PI_SUBAGENT_CHILD === "1";

	pi.on("before_agent_start", async (_event, ctx) => {
		if (isSubagent) return;

		const entries = ctx.sessionManager.getEntries();
		const alreadyInjected = entries.some(
			(e) => e.type === "custom" && e.customType === CONTENT_TYPE,
		);
		if (alreadyInjected) return;

		return {
			message: {
				customType: CONTENT_TYPE,
				content: SESSION_START_CONTENT,
				display: false,
			},
		};
	});
}
