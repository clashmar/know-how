/**
 * Know-how extension for pi.
 *
 * Injects bootstrap context into the first user message, registers the
 * /know-how command with a workflow-picker menu, and exposes the bundled
 * skills directory for pi discovery.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// ---------------------------------------------------------------------------
// Path resolution
// ---------------------------------------------------------------------------

const SKILLS_DIR = path.resolve(__dirname, "skills");
const USING_KNOW_HOW_PATH = path.join(SKILLS_DIR, "using-know-how", "SKILL.md");

// ---------------------------------------------------------------------------
// Frontmatter extraction
// ---------------------------------------------------------------------------

const extractAndStripFrontmatter = (
	content: string,
): { frontmatter: Record<string, string>; content: string } => {
	const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
	if (!match) return { frontmatter: {}, content };

	const frontmatterStr = match[1];
	const body = match[2];
	const frontmatter: Record<string, string> = {};

	for (const line of frontmatterStr.split("\n")) {
		const colonIdx = line.indexOf(":");
		if (colonIdx > 0) {
			const key = line.slice(0, colonIdx).trim();
			const value = line
				.slice(colonIdx + 1)
				.trim()
				.replace(/^["']|["']$/g, "");
			frontmatter[key] = value;
		}
	}

	return { frontmatter, content: body };
};

// ---------------------------------------------------------------------------
// pi-memory lazy import (best-effort — if not installed, catch-up uses files only)
// ---------------------------------------------------------------------------

let _piMemory: any;

function getPiMemory(): any {
	if (_piMemory !== undefined) return _piMemory;
	try {
		_piMemory = require("@samfp/pi-memory");
	} catch {
		_piMemory = null;
	}
	return _piMemory;
}

// ---------------------------------------------------------------------------
// Project name derivation (matches writing-plans convention)
// ---------------------------------------------------------------------------

function getProjectName(cwd: string): string {
	return path
		.basename(cwd)
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

// ---------------------------------------------------------------------------
// Reflection file helpers
// ---------------------------------------------------------------------------

const REFLECTIONS_DIR = (projectName: string): string =>
	path.join(os.homedir(), ".know-how", projectName, "reflections");

interface ReflectionSummary {
	date: string;
	topic: string;
	scope: string;
	recurring: string[];
	remaining: string[];
}

function parseReflection(filePath: string): ReflectionSummary | null {
	try {
		const raw = fs.readFileSync(filePath, "utf8");
		const name = path.basename(filePath, ".md");
		// Filename format: YYYY-MM-DD-topic.md
		const dateMatch = name.match(/^(\d{4}-\d{2}-\d{2})-(.+)$/);

		// Extract sections
		const scopeMatch = raw.match(/\*\*Scope:\*\*\s*(.+)/);
		const recurringSection = extractListSection(
			raw,
			"Recurring problems to watch",
		);
		const remainingSection = extractListSection(raw, "Remaining work");

		return {
			date: dateMatch ? dateMatch[1] : "",
			topic: dateMatch ? dateMatch[2].replace(/-/g, " ") : name,
			scope: scopeMatch ? scopeMatch[1].trim() : "",
			recurring: recurringSection,
			remaining: remainingSection,
		};
	} catch {
		return null;
	}
}

/** Extract list items from a named markdown section. */
function extractListSection(raw: string, sectionName: string): string[] {
	const regex = new RegExp(`## ${sectionName}\\n((?:- .+\\n?)*)`, "m");
	const match = raw.match(regex);
	if (!match || !match[1]) return [];
	return match[1]
		.split("\n")
		.map((line) => line.replace(/^- /, "").trim())
		.filter((line) => line.length > 0);
}

function getRecentReflections(
	projectName: string,
): { file: string; summary: ReflectionSummary }[] {
	const dir = REFLECTIONS_DIR(projectName);
	if (!fs.existsSync(dir)) return [];

	const files = fs
		.readdirSync(dir)
		.filter((f) => f.endsWith(".md"))
		.sort()
		.reverse()
		.slice(0, 2);

	const results: { file: string; summary: ReflectionSummary }[] = [];
	for (const file of files) {
		const summary = parseReflection(path.join(dir, file));
		if (summary) results.push({ file, summary });
	}
	return results;
}

// ---------------------------------------------------------------------------
// Catch-up content synthesis
// ---------------------------------------------------------------------------

interface CatchUpResult {
	block: string;
	summary: string;
}

function buildCatchUpBlock(projectName: string): CatchUpResult | null {
	const reflections = getRecentReflections(projectName);
	const piMemory = getPiMemory();

	let piFacts: string[] = [];
	if (piMemory) {
		let store: any = null;
		try {
			const dbPath = piMemory.resolveDbPath(process.cwd());
			store = new piMemory.MemoryStore(dbPath);
			const results = store.searchSemantic(projectName, 10);
			piFacts = results.map((r: any) => `${r.key}: ${r.value}`);
		} catch {
			// pi-memory query failed — continue without it
		} finally {
			if (store) store.close();
		}
	}

	if (reflections.length === 0 && piFacts.length === 0) return null;

	const lines: string[] = [];
	lines.push("<project-state>");
	lines.push(`You're working on **${projectName}**.`);
	lines.push("");

	// Recent reflections
	if (reflections.length > 0) {
		lines.push("Recent reflections:");
		for (const { summary } of reflections) {
			const scopeSuffix = summary.scope ? ` — ${summary.scope}` : "";
			lines.push(`- ${summary.date}: ${summary.topic}${scopeSuffix}`);
		}
		lines.push("");

		// Recurring problems
		const allRecurring = reflections.flatMap((r) => r.summary.recurring);
		if (allRecurring.length > 0) {
			lines.push("Recurring patterns to watch:");
			for (const item of allRecurring) {
				lines.push(`- ${item}`);
			}
			lines.push("");
		}
	}

	// pi-memory facts
	if (piFacts.length > 0) {
		lines.push("Key facts from memory:");
		for (const fact of piFacts.slice(0, 8)) {
			lines.push(`- ${fact}`);
		}
		lines.push("");
	}

	// Remaining work
	const allRemaining = reflections.flatMap((r) => r.summary.remaining);
	if (allRemaining.length > 0) {
		lines.push("Active decisions that may still need work:");
		for (const item of allRemaining) {
			lines.push(`- ${item}`);
		}
		lines.push("");
	}

	lines.push("");
	lines.push(
		"This is context for your next task — no exploration or action needed. Continue to the user's request.",
	);
	lines.push("</project-state>");

	const block = lines.join("\n");

	// Build summary for notification
	const parts: string[] = [];
	if (reflections.length > 0) {
		const topics = reflections.map((r) => r.summary.topic).join(", ");
		parts.push(
			`${reflections.length} reflection${reflections.length > 1 ? "s" : ""} (${topics})`,
		);
	}
	if (piFacts.length > 0) {
		parts.push(`${piFacts.length} memory fact${piFacts.length > 1 ? "s" : ""}`);
	}
	const summary = `Caught up: ${parts.join(", ")}`;

	// Size guard: cap at 3KB
	let finalBlock = block;
	if (Buffer.byteLength(block, "utf8") > 3072) {
		const truncated = block.slice(0, 2800);
		finalBlock = truncated + "\n...(trimmed for length)\n</project-state>";
	}

	return { block: finalBlock, summary };
}

// ---------------------------------------------------------------------------
// Bootstrap content builder
// ---------------------------------------------------------------------------

let _bootstrapContent: string | null = null;

const getBootstrapContent = (): string | null => {
	if (_bootstrapContent !== null) return _bootstrapContent;

	if (!fs.existsSync(USING_KNOW_HOW_PATH)) {
		_bootstrapContent = "";
		return _bootstrapContent;
	}

	const fullContent = fs.readFileSync(USING_KNOW_HOW_PATH, "utf8");
	const { content } = extractAndStripFrontmatter(fullContent);

	_bootstrapContent = `<EXTREMELY_IMPORTANT>
Know-how is available in this session.

**IMPORTANT: The using-know-how skill content is included below. It is ALREADY LOADED — you are currently following it. Do NOT read the SKILL.md file again — that would be redundant.**

${content}
</EXTREMELY_IMPORTANT>`;

	return _bootstrapContent;
};

// ---------------------------------------------------------------------------
// Skill routing map for /know-how command
// ---------------------------------------------------------------------------

const SKILL_ROUTES: Record<string, { label: string; skill: string }> = {
	brainstorm: {
		label: "brainstorm — Turn a rough idea into an approved design",
		skill: "brainstorming",
	},
	"write-plan": {
		label: "write-plan — Create an implementation plan from a spec",
		skill: "writing-plans",
	},
	"execute-plan": {
		label: "execute-plan — Execute a plan task-by-task",
		skill: "executing-plans",
	},
	"debug": {
		label: "debug — Systematic root-cause debugging",
		skill: "systematic-debugging",
	},
	"code-review": {
		label: "code-review — Request a code review",
		skill: "requesting-code-review",
	},
	"close-out": {
		label: "close-out — Verify, clean up, and integrate finished work",
		skill: "closing-out-work",
	},
	"reflect": {
		label:
			"reflect — Capture session reflection (decisions, corrections, lessons)",
		skill: "session-reflection",
	},
	"catch-up": {
		label: "catch-up — Reconstruct project context from reflections + memory",
		skill: "session-reflection",
	},
};

const MENU_OPTIONS = Object.entries(SKILL_ROUTES).map(
	([_key, { label }]) => label,
);

const loadSkillContent = (skillName: string): string | null => {
	const skillPath = path.join(SKILLS_DIR, skillName, "SKILL.md");
	if (!fs.existsSync(skillPath)) return null;
	const fullContent = fs.readFileSync(skillPath, "utf8");
	const { content } = extractAndStripFrontmatter(fullContent);
	return content;
};

// ---------------------------------------------------------------------------
// Extension entry point
// ---------------------------------------------------------------------------

export default function (pi: ExtensionAPI) {
	// Expose skills directory for pi auto-discovery
	pi.on("resources_discover", async (_event, _ctx) => {
		if (fs.existsSync(SKILLS_DIR)) {
			return { skillPaths: [SKILLS_DIR] };
		}
		return {};
	});

	// Inject bootstrap into the first user message of each session
	pi.on("before_agent_start", async (event, ctx) => {
		const bootstrap = getBootstrapContent();
		if (!bootstrap) return;

		// Prevent double-injection within the same session
		const entries = ctx.sessionManager.getEntries();
		const alreadyInjected = entries.some(
			(e) => e.type === "custom" && e.customType === "know-how-bootstrap",
		);
		if (alreadyInjected) return;

		return {
			message: {
				customType: "know-how-bootstrap",
				content: bootstrap,
				display: false,
			},
		};
	});

	// Inject catch-up context on first user message of each session
	pi.on("before_agent_start", async (event, ctx) => {
		// Prevent double-injection within the same session
		const entries = ctx.sessionManager.getEntries();
		const alreadyInjected = entries.some(
			(e) => e.type === "custom" && e.customType === "know-how-catch-up",
		);
		if (alreadyInjected) return;

		const projectName = getProjectName(ctx.cwd);
		const result = buildCatchUpBlock(projectName);
		if (!result) return; // silent no-op when nothing to catch up on

		return {
			message: {
				customType: "know-how-catch-up",
				content: result.block,
				display: false,
			},
		};
	});

	// Prompt for reflection on session exit (non-blocking)
	pi.on("session_before_switch", async (_event, ctx) => {
		// Count user messages in current session
		const entries = ctx.sessionManager.getEntries();
		const userMessageCount = entries.filter(
			(e) => e.type === "message" && (e as any).message?.role === "user",
		).length;

		if (userMessageCount >= 5) {
			ctx.ui.setStatus(
				"know-how",
				"💭 Consider /reflect to capture what you learned",
			);
			// Clear after 5 seconds — non-blocking, does not delay exit
			setTimeout(() => {
				try {
					ctx.ui.setStatus("know-how", "");
				} catch {
					/* ctx stale — harmless */
				}
			}, 5000);
		}
	});

	// Register /know-how command with workflow menu
	pi.registerCommand("know-how", {
		description:
			"Know-how workflow picker — brainstorm, plan, execute, debug, review, close-out",
		handler: async (args, ctx) => {
			// Direct routing: /know-how brainstorm
			if (args) {
				const key = args.trim().toLowerCase();

				// Special case: /catch-up injects the synthesized block directly
				if (key === "catch-up") {
					const projectName = getProjectName(ctx.cwd);
					const result = buildCatchUpBlock(projectName);
					if (result) {
						pi.sendMessage(
							{
								customType: "know-how-catch-up",
								content: result.block,
								display: false,
							},
							{ deliverAs: "steer" },
						);
						ctx.ui.notify(result.summary, "info");
					} else {
						ctx.ui.notify(
							"No reflections or project memory found for this project.",
							"info",
						);
					}
					return;
				}

				const route = SKILL_ROUTES[key];
				if (route) {
					const skillContent = loadSkillContent(route.skill);
					if (skillContent) {
						// Inject bootstrap + skill content as a steer message
						const bootstrap = getBootstrapContent();
						pi.sendMessage(
							{
								customType: "know-how-skill-load",
								content: `${bootstrap ?? ""}\n\n<LOADED_SKILL name="${route.skill}">\n${skillContent}\n</LOADED_SKILL>`,
								display: false,
							},
							{ deliverAs: "steer", triggerTurn: true },
						);
						ctx.ui.notify(`Loaded know-how:${key}`, "info");
						return;
					}
				}
				ctx.ui.notify(
					`Unknown know-how command: "${args}". Try /know-how for the menu.`,
					"error",
				);
				return;
			}

			// Menu mode
			if (!ctx.hasUI) {
				ctx.ui.notify(
					"Know-how menu requires interactive mode. Use /know-how <action> directly.",
					"info",
				);
				return;
			}

			const choice = await ctx.ui.select(
				"What do you want to do?",
				MENU_OPTIONS,
			);
			if (!choice) return;

			// Special case: catch-up from menu must call buildCatchUpBlock, not load skill
			if (choice === SKILL_ROUTES["catch-up"].label) {
				const projectName = getProjectName(ctx.cwd);
				const result = buildCatchUpBlock(projectName);
				if (result) {
					pi.sendMessage(
						{
							customType: "know-how-catch-up",
							content: result.block,
							display: false,
						},
						{ deliverAs: "steer" },
					);
					ctx.ui.notify(result.summary, "info");
				} else {
					ctx.ui.notify(
						"No reflections or project memory found for this project.",
						"info",
					);
				}
				return;
			}

			// Find matching route
			for (const [key, { label, skill }] of Object.entries(SKILL_ROUTES)) {
				if (label === choice) {
					const skillContent = loadSkillContent(skill);
					if (skillContent) {
						const bootstrap = getBootstrapContent();
						pi.sendMessage(
							{
								customType: "know-how-skill-load",
								content: `${bootstrap ?? ""}\n\n<LOADED_SKILL name="${skill}">\n${skillContent}\n</LOADED_SKILL>`,
								display: false,
							},
							{ deliverAs: "steer", triggerTurn: true },
						);
						ctx.ui.notify(`Loaded know-how:${key}`, "info");
					}
					break;
				}
			}
		},
	});

	// Register /reflect command
	pi.registerCommand("reflect", {
		description:
			"Capture a session reflection (decisions, corrections, recurring problems)",
		handler: async (args, ctx) => {
			const skillContent = loadSkillContent("session-reflection");
			if (!skillContent) {
				ctx.ui.notify("session-reflection skill not found", "error");
				return;
			}
			const bootstrap = getBootstrapContent();
			let content = `${bootstrap ?? ""}\n\n<LOADED_SKILL name="session-reflection">\n${skillContent}\n</LOADED_SKILL>`;
			if (args) {
				content += `\n\nUser specified topic: ${args}`;
			}
			pi.sendMessage(
				{
					customType: "know-how-skill-load",
					content,
					display: false,
				},
				{ deliverAs: "steer", triggerTurn: true },
			);
			const topicInfo = args ? ` (topic: ${args})` : "";
			ctx.ui.notify(`Loaded session-reflection skill${topicInfo}`, "info");
		},
	});

	// Register /catch-up command
	pi.registerCommand("catch-up", {
		description: "Reconstruct project context from reflections and pi-memory",
		handler: async (_args, ctx) => {
			const projectName = getProjectName(ctx.cwd);
			const result = buildCatchUpBlock(projectName);
			if (result) {
				pi.sendMessage(
					{
						customType: "know-how-catch-up",
						content: result.block,
						display: false,
					},
					{ deliverAs: "steer" },
				);
				ctx.ui.notify(result.summary, "info");
			} else {
				ctx.ui.notify(
					"No reflections or project memory found for this project.",
					"info",
				);
			}
		},
	});
}
