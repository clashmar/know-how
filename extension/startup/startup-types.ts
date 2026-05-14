export const CUSTOM_MESSAGE_ENTRY_TYPE = "custom_message";
export const KNOW_HOW_BOOTSTRAP_MESSAGE_TYPE = "know-how-bootstrap";
export const KNOW_HOW_CATCH_UP_MESSAGE_TYPE = "know-how-catch-up";
export const KNOW_HOW_CONVENTIONS_MESSAGE_TYPE = "know-how-conventions";
export const KNOW_HOW_SKILL_LOAD_MESSAGE_TYPE = "know-how-skill-load";

export const getProjectSkillMessageType = (skillName: string): string =>
	`project-skill-${skillName}`;
