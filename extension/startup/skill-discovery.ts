/**
 * Project skill discovery and utilities for the know-how extension.
 *
 * Detects project-specific skills from CWD by walking up directory trees
 * (or from git root in worktrees), then loads and strips frontmatter.
 * Also provides shared utilities used throughout the extension.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Directory where project skills are stored: ~/.pi/agent/skills/ */
export const PROJECT_SKILLS_DIR = path.join(
	os.homedir(),
	".pi",
	"agent",
	"skills",
);

// ---------------------------------------------------------------------------
// Frontmatter extraction
// ---------------------------------------------------------------------------

/**
 * Extract YAML-like frontmatter from a markdown file and return it separated
 * from the body content. Returns empty objects if no frontmatter is found.
 */
export const extractAndStripFrontmatter = (
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
// Git root canonicalization (worktree-aware)
// ---------------------------------------------------------------------------

/**
 * Resolve the git root for a working directory via `git rev-parse --show-toplevel`.
 * Returns null if the directory is not inside a git repo.
 */
function getGitRoot(cwd: string): string | null {
	try {
		const result = require("child_process").execSync(
			"git rev-parse --show-toplevel",
			{ cwd, encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] },
		);
		return result.trim();
	} catch {
		return null;
	}
}

// ---------------------------------------------------------------------------
// Project name derivation (matches writing-plans convention)
// ---------------------------------------------------------------------------

/**
 * Derive a canonical project name from a working directory.
 * Uses git root when available so worktrees resolve to the same name as the
 * main repo (e.g. "bishop" not "bishop-feature-x").
 */
export function getProjectName(cwd: string): string {
	const gitRoot = getGitRoot(cwd);
	const baseDir = gitRoot || cwd;
	return path
		.basename(baseDir)
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

// ---------------------------------------------------------------------------
// Project skill discovery
// ---------------------------------------------------------------------------

/**
 * Walk up from cwd, checking each directory name against project skill
 * directories in ~/.pi/agent/skills/. Stops at .git boundaries and at the
 * home directory. Canonicalizes via git root so worktrees resolve to the
 * correct project name.
 *
 * Returns the matching skill name, or null if no match is found.
 */
export function findProjectSkill(cwd: string): string | null {
	const homeDir = os.homedir();
	const gitRoot = getGitRoot(cwd);
	let current = gitRoot || cwd;

	while (current !== homeDir && current !== path.dirname(current)) {
		const name = path
			.basename(current)
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-|-$/g, "");
		const skillPath = path.join(PROJECT_SKILLS_DIR, name, "SKILL.md");
		if (fs.existsSync(skillPath)) {
			return name;
		}

		// Stop at git root — parent directories belong to other projects
		if (fs.existsSync(path.join(current, ".git"))) {
			break;
		}

		current = path.dirname(current);
	}

	return null;
}

/**
 * Load and strip frontmatter from a project skill file.
 * Returns the body content and a display description, or null if the skill
 * file doesn't exist or is empty.
 */
export function loadProjectSkill(
	skillName: string,
): { content: string; description: string } | null {
	const skillPath = path.join(PROJECT_SKILLS_DIR, skillName, "SKILL.md");
	if (!fs.existsSync(skillPath)) return null;

	const fullContent = fs.readFileSync(skillPath, "utf8");
	const { frontmatter, content } = extractAndStripFrontmatter(fullContent);
	const trimmed = content.trim();
	if (!trimmed) return null;

	return {
		content: trimmed,
		description: frontmatter.description || frontmatter.name || skillName,
	};
}
