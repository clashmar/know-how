/** Canonical pi-memory semantic namespace for project facts. */
export const MEMORY_NAMESPACES = ["project"] as const;
export type MemoryNamespace = (typeof MEMORY_NAMESPACES)[number];

/** Canonical key format: project.{project}.{fact} */
export const KEY_FORMAT = "project.{project}.{fact}" as const;

/**
 * Validates a pi-memory key against the canonical convention.
 * Returns `null` if valid, or an error string describing the violation.
 */
export function validateMemoryKey(key: string, projectName: string): string | null {
  const segments = key.split(".");

  if (segments.length !== 3) {
    return `Expected exactly 3 dot-separated segments, got ${segments.length}`;
  }

  const [namespace, project, fact] = segments as [string, string, string];

  if (!MEMORY_NAMESPACES.includes(namespace as MemoryNamespace)) {
    return `Unknown namespace "${namespace}". Allowed: ${MEMORY_NAMESPACES.join(", ")}`;
  }

  if (project !== projectName) {
    return `Project segment "${project}" does not match expected "${projectName}"`;
  }

  if (fact.length === 0) {
    return "Fact segment must not be empty";
  }

  return null;
}
