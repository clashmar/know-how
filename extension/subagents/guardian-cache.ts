import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  extractAndStripFrontmatter,
  getProjectName,
} from "../startup/skill-discovery";

const GUARDIAN_AGENT_NAME = "guardian";
const GUARDIAN_BUNDLE_TAG = "guardian-conventions-bundle";
const guardianResponseCache = new Map<string, string>();

interface GuardianConventionSource {
  label: string;
  path: string;
  hash: string;
  content: string;
}

/** Optional environment overrides for guardian dispatch preparation. */
export interface GuardianDispatchOptions {
  homeDir?: string;
}

/** Inputs required to prepare a guardian dispatch request. */
export interface GuardianDispatchParams {
  agentName: string;
  task: string;
  cwd: string;
  promptText: string;
  modelSignature: string;
}

/** Prepared guardian dispatch payload plus any exact-hit cached response. */
export interface GuardianDispatchPreparation {
  task: string;
  cacheKey: string | null;
  cachedResponse?: string;
}

/** Clears the in-memory guardian review cache. */
export function clearGuardianDispatchCache(): void {
  guardianResponseCache.clear();
}

/** Stores a successful guardian response for an exact future replay. */
export function rememberGuardianDispatch(cacheKey: string | null, response: string): void {
  if (!cacheKey) return;
  guardianResponseCache.set(cacheKey, response);
}

/** Prepares guardian dispatch input and returns an exact-hit cache result when available. */
export function prepareGuardianDispatch(
  params: GuardianDispatchParams,
  options: GuardianDispatchOptions = {},
): GuardianDispatchPreparation {
  if (params.agentName !== GUARDIAN_AGENT_NAME) {
    return {
      task: params.task,
      cacheKey: null,
    };
  }

  const reviewRoot = resolveReviewRoot(params.task, params.cwd);
  const conventionSources = resolveGuardianConventionSources(reviewRoot, options);
  const bundle = buildGuardianConventionBundle(conventionSources);
  const task = params.task.includes(`<${GUARDIAN_BUNDLE_TAG}>`) || bundle.length === 0
    ? params.task
    : `${bundle}\n\n${params.task}`;
  const cacheKey = createGuardianCacheKey({
    task,
    promptText: params.promptText,
    modelSignature: params.modelSignature,
    reviewRoot,
    conventionSources,
  });

  return {
    task,
    cacheKey,
    cachedResponse: guardianResponseCache.get(cacheKey),
  };
}

function buildGuardianConventionBundle(sources: GuardianConventionSource[]): string {
  if (sources.length === 0) return "";

  const lines = [
    `<${GUARDIAN_BUNDLE_TAG}>`,
    "Use this bundle as the authoritative conventions input for this review.",
    "It was assembled from disk immediately before dispatch.",
    "Only fall back to reading the source files yourself if a required section is missing or clearly inconsistent.",
    "",
  ];

  for (const source of sources) {
    lines.push(`## ${source.label}`);
    lines.push(`Path: ${source.path}`);
    lines.push(`SHA256: ${source.hash}`);
    lines.push("");
    lines.push(source.content.trim());
    lines.push("");
  }

  lines.push(`</${GUARDIAN_BUNDLE_TAG}>`);
  return lines.join("\n").trim();
}

function createGuardianCacheKey(params: {
  task: string;
  promptText: string;
  modelSignature: string;
  reviewRoot: string;
  conventionSources: GuardianConventionSource[];
}): string {
  const touchedFiles = extractTouchedFilesFromTask(params.task);
  const fileFingerprints = touchedFiles.map((relativePath) => {
    const absolutePath = path.resolve(params.reviewRoot, relativePath);
    if (!fs.existsSync(absolutePath)) {
      return { path: relativePath, state: "missing" };
    }

    const stat = fs.statSync(absolutePath);
    if (!stat.isFile()) {
      return { path: relativePath, state: "not-file" };
    }

    return {
      path: relativePath,
      state: "present",
      hash: hashBuffer(fs.readFileSync(absolutePath)),
    };
  });

  return hashString(JSON.stringify({
    version: 1,
    task: params.task,
    promptHash: hashString(params.promptText),
    modelSignature: params.modelSignature,
    reviewRoot: params.reviewRoot,
    conventionSources: params.conventionSources.map((source) => ({
      label: source.label,
      path: source.path,
      hash: source.hash,
    })),
    fileFingerprints,
  }));
}

function resolveGuardianConventionSources(
  reviewRoot: string,
  options: GuardianDispatchOptions,
): GuardianConventionSource[] {
  const homeDir = options.homeDir ?? os.homedir();
  const sources: GuardianConventionSource[] = [];
  const globalAgentsPath = path.join(homeDir, ".pi", "agent", "AGENTS.md");
  const repoRoot = resolveGitRoot(reviewRoot) ?? reviewRoot;
  const repoAgentsPath = path.join(repoRoot, "AGENTS.md");
  const projectSkillPath = path.join(
    homeDir,
    ".pi",
    "agent",
    "skills",
    getProjectName(reviewRoot),
    "SKILL.md",
  );

  pushConventionSource(sources, "Global AGENTS", globalAgentsPath);
  pushConventionSource(sources, "Repo AGENTS", repoAgentsPath);
  pushConventionSource(sources, "Project Skill", projectSkillPath, true);

  return sources;
}

function pushConventionSource(
  sources: GuardianConventionSource[],
  label: string,
  filePath: string,
  stripFrontmatter = false,
): void {
  if (!fs.existsSync(filePath)) return;
  const rawContent = fs.readFileSync(filePath, "utf8");
  const content = stripFrontmatter ? extractAndStripFrontmatter(rawContent).content.trim() : rawContent.trim();
  if (!content) return;

  sources.push({
    label,
    path: filePath,
    hash: hashString(rawContent),
    content,
  });
}

function extractTouchedFilesFromTask(task: string): string[] {
  const paths = new Set<string>();

  for (const line of task.split("\n")) {
    const match = line.match(/^(?:DIFF:\s*)?diff --git a\/(.+?) b\/(.+)$/);
    if (!match) continue;
    const oldPath = match[1].trim();
    const newPath = match[2].trim();
    if (oldPath !== "dev/null") paths.add(oldPath);
    if (newPath !== "dev/null") paths.add(newPath);
  }

  return [...paths].sort();
}

function resolveReviewRoot(task: string, fallbackCwd: string): string {
  const workFrom = task.match(/^\s*WORK_FROM:\s*(.+)$/m)?.[1]?.trim();
  return workFrom || fallbackCwd;
}

function resolveGitRoot(cwd: string): string | null {
  try {
    return execSync("git rev-parse --show-toplevel", {
      cwd,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

function hashBuffer(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function hashString(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
