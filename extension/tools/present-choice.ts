import { Type } from "@sinclair/typebox";
import { ChoicePicker } from "../ui/choice-picker";
import type { ChoiceOption } from "../ui/choice-picker";
import type { ExtensionAPI, AgentToolResult } from "@mariozechner/pi-coding-agent";

/** Sentinel value indicating the user cancelled the choice. */
export const CANCELLED_SENTINEL = "(cancelled)";

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

/** Registers the present_choice tool with the pi agent. */
export function registerPresentChoice(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "present_choice",
    label: "Present Choice",
    description:
      "Shows a picker overlay (arrow-key navigable) for the user to select from a list of options. " +
      "Always includes a 'Something else...' option for free-text input. " +
      "Use this whenever the user needs to pick one of several options. " +
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

      return ctx.ui.custom<string | null>((tui, theme, _kb, done) => {
        const picker = new ChoicePicker(params.title, options, theme, otherLabel);
        picker.onSelect = (value) => done(value);
        picker.onCancel = () => done(null);
        picker.onRequestRender = () => tui.requestRender();
        return picker;
      }).then((result) => {
        const output = result === null ? CANCELLED_SENTINEL : result;
        return {
          content: [{ type: "text", text: output }],
          details: {},
        };
      });
    },
  });
}
