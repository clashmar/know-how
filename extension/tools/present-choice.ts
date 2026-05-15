import { Type } from "@sinclair/typebox";
import { ChoicePicker } from "../ui/choice-picker";
import type { ChoiceOption } from "../ui/choice-picker";
// @mariozechner/pi-coding-agent is deprecated upstream; will migrate when @samfp/pi-memory updates
import type { ExtensionAPI, AgentToolResult, ExtensionUIContext } from "@mariozechner/pi-coding-agent"; 
import { activateApprovedWriteMode } from "../write-mode/runtime";
import { CANCELLED_SENTINEL, isWriteModeEnableSelection } from "../write-mode/signals";

/** Parameters for the present_choice tool. */
export const PresentChoiceParams = Type.Object({
  title: Type.String(),
  options: Type.Array(Type.Object({
    label: Type.String(),
    description: Type.Optional(Type.String()),
    value: Type.Optional(Type.String()),
  })),
  otherLabel: Type.Optional(Type.String()),
});

/**
 * Shared helper to show a choice picker via ctx.ui.custom().
 * Returns the selected value string, or null if cancelled.
 */
export async function showPresentChoice(
  ui: ExtensionUIContext,
  params: {
    title: string;
    options: ChoiceOption[];
    otherLabel?: string;
  },
): Promise<string | null> {
  const options: ChoiceOption[] = params.options;
  const otherLabel = params.otherLabel || "Something else...";

  if (options.length === 0) return null;

  return ui.custom<string | null>((tui, theme, _kb, done) => {
    const picker = new ChoicePicker(params.title, options, theme, otherLabel);
    picker.onSelect = (value) => done(value);
    picker.onCancel = () => done(null);
    picker.onRequestRender = () => tui.requestRender();
    return picker;
  });
}

/** Registers the present_choice tool with the pi agent. */
export function registerPresentChoice(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "present_choice",
    label: "Present Choice",
    description:
      "Shows a picker overlay (arrow-key navigable) for selecting one option. " +
      "Automatically appends an 'other' option at the end for free-text input. " +
      "Default other label is 'Something else...'; otherLabel overrides it. " +
      "Do not add your own other option in options, and keep otherLabel short. " +
      "Do NOT ask the user to type their choice — call this tool instead.",
    parameters: PresentChoiceParams,

    async execute(_toolCallId, params, _signal, _onUpdate, ctx): Promise<AgentToolResult<unknown>> {
      const options: ChoiceOption[] = params.options;
      const otherLabel = params.otherLabel || "Something else...";

      if (options.length === 0) {
        return {
          content: [{ type: "text", text: "Error: options array must not be empty" }],
          details: {},
        };
      }

      const result = await showPresentChoice(ctx.ui, { title: params.title, options, otherLabel });
      if (result !== null && isWriteModeEnableSelection(result)) {
        activateApprovedWriteMode(ctx);
      }
      const output = result === null ? CANCELLED_SENTINEL : result;
      return {
        content: [{ type: "text", text: output }],
        details: {},
      };
    },
  });
}
