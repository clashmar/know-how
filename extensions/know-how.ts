/**
 * Know-how extension for pi.
 *
 * Injects bootstrap context into the first user message, registers the
 * /know-how command with a workflow-picker menu, and exposes the bundled
 * skills directory for pi discovery.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import fs from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// Path resolution
// ---------------------------------------------------------------------------

const SKILLS_DIR = path.resolve(__dirname, "../skills");
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

	const toolMapping = `**Tool Mapping for pi:**
When skills reference tools you don't have, substitute pi equivalents:
- \`TodoWrite\` → use the \`todo\` tool (create/update/list/delete — same semantics)
- \`Task\` / subagent dispatch → use the \`subagent\` tool
- \`Skill\` tool / OpenCode's skill tool → read the SKILL.md file directly, or use \`/skill:name\`
- \`Read\`, \`Write\`, \`Edit\`, \`Bash\` → your native tools (same names)

**Artifact paths:** Use \`~/.know-how/<project>/\` for specs and plans (cross-harness convention).`;

	_bootstrapContent = `<EXTREMELY_IMPORTANT>
Know-how is available in this session.

**IMPORTANT: The using-know-how skill content is included below. It is ALREADY LOADED — you are currently following it. Do NOT read the SKILL.md file again — that would be redundant.**

${content}

${toolMapping}
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
	debug: {
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

	// Register /know-how command with workflow menu
	pi.registerCommand("know-how", {
		description:
			"Know-how workflow picker — brainstorm, plan, execute, debug, review, close-out",
		handler: async (args, ctx) => {
			// Direct routing: /know-how brainstorm
			if (args) {
				const key = args.trim().toLowerCase();
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
}
