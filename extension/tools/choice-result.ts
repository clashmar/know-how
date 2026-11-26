/** Prefix added to a reply the user typed into the "other" option. */
export const FREE_TEXT_REPLY_PREFIX = "User's own reply (not one of the options): ";

/** Sentence appended to choice tool descriptions so the model knows what the prefix means. */
export const FREE_TEXT_REPLY_NOTE =
  "A reply typed into the other option comes back marked as the user's own reply; " +
  "treat it as a message from the user, not as a listed option.";

/** A confirmed answer from the choice picker. */
export interface ChoiceSelection {
  value: string;
  isFreeText: boolean;
}

/** Formats a single reply for the model, marking free text. */
export function formatChoiceReply(value: string, isFreeText: boolean): string {
  if (!isFreeText) return value;
  return `${FREE_TEXT_REPLY_PREFIX}"${value}"`;
}

/** Formats decision form answers as one line per decision, marking free-text ones. */
export function formatDecisionLines(
  values: Record<string, string>,
  freeTextLabels: ReadonlySet<string>,
): string[] {
  return Object.entries(values).map(
    ([label, value]) => `- ${label}: ${formatChoiceReply(value, freeTextLabels.has(label))}`,
  );
}
