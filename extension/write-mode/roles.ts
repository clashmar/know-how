/** Source-of-truth list of read-only role names. */
export const READ_ONLY_ROLES = ["scout", "guardian"] as const;

/** Source-of-truth list of write-capable role names. */
export const WRITE_CAPABLE_ROLES = ["maester"] as const;

type ReadOnlyRole = (typeof READ_ONLY_ROLES)[number];

const READ_ONLY_ROLE_LABELS: Record<ReadOnlyRole, string> = {
  scout: "Scouts",
  guardian: "guardians",
};

/** Formats the read-only role summary used in user-facing prompts. */
export function describeReadOnlyRoles(): string {
  const labels = READ_ONLY_ROLES.map((role) => READ_ONLY_ROLE_LABELS[role]);

  if (labels.length === 1) {
    return labels[0];
  }

  if (labels.length === 2) {
    return `${labels[0]} and ${labels[1]}`;
  }

  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
}
