/** Canonical pi-memory key domains. */
export const MEMORY_DOMAINS = ["project", "decision", "lesson"] as const;
export type MemoryDomain = (typeof MEMORY_DOMAINS)[number];

/** Canonical key format: {project}.{domain}.{fact} */
export const KEY_FORMAT = "{project}.{domain}.{fact}" as const;

/**
 * Validates a pi-memory key against the canonical convention.
 * Returns `null` if valid, or an error string describing the violation.
 */
export function validateMemoryKey(key: string, projectName: string): string | null {
  const segments = key.split(".");

  if (segments.length !== 3) {
    return `Expected exactly 3 dot-separated segments, got ${segments.length}`;
  }

  const [project, domain, fact] = segments as [string, string, string];

  if (!MEMORY_DOMAINS.includes(domain as MemoryDomain)) {
    return `Unknown domain "${domain}". Allowed: ${MEMORY_DOMAINS.join(", ")}`;
  }

  if (project !== projectName) {
    return `Project segment "${project}" does not match expected "${projectName}"`;
  }

  if (fact.length === 0) {
    return "Fact segment must not be empty";
  }

  return null;
}
