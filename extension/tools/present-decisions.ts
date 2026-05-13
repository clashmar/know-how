import { Type } from "@sinclair/typebox";
import { DecisionForm } from "../ui/decision-form";
import type { Decision, DecisionOption } from "../ui/decision-form";
import type { ExtensionAPI, AgentToolResult } from "@mariozechner/pi-coding-agent";

/** Parameters for the present_decisions tool — presents a tabbed multi-decision form overlay. */
export const PresentDecisionsParams = Type.Object({
  title: Type.String(),
  decisions: Type.Array(Type.Object({
    label: Type.String(),
    tooltip: Type.Optional(Type.String()),
    options: Type.Array(Type.Object({
      label: Type.String(),
      value: Type.String(),
      description: Type.Optional(Type.String()),
    })),
    otherLabel: Type.Optional(Type.String()),
  })),
});

/** Registers the present_decisions tool on the given extension API. */
export function registerPresentDecisions(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "present_decisions",
    label: "Present Decisions",
    description:
      "Shows a tabbed multi-decision form (Tab to switch, Enter to submit all). " +
      "Use this when the user needs to make multiple related choices at once " +
      "(e.g. execution style + worktree strategy + autonomy level). " +
      "Do NOT ask the user to type their choices — call this tool instead.",
    parameters: PresentDecisionsParams,

    async execute(_toolCallId, params, _signal, _onUpdate, ctx): Promise<AgentToolResult<unknown>> {
      const decisions: Decision[] = params.decisions.map((d: { label: string; options: DecisionOption[]; tooltip?: string; otherLabel?: string }) => ({
        label: d.label,
        options: d.options,
        tooltip: d.tooltip,
        otherLabel: d.otherLabel,
      }));

      if (decisions.length === 0) {
        return {
          content: [{ type: "text", text: "Error: decisions array must not be empty" }],
          details: {},
        };
      }

      const result = await ctx.ui.custom<Record<string, string> | null>((_tui, theme, _kb, done) => {
        const form = new DecisionForm(params.title, decisions, theme);
        form.onSubmit = (results) => done(results);
        form.onCancel = () => done(null);
        form.onRequestRender = () => _tui.requestRender();
        return form;
      });

      if (result === null) {
        return {
          content: [{ type: "text", text: "(no selection)" }],
          details: {},
        };
      }

      const lines = Object.entries(result).map(([key, value]) => `- ${key}: ${value}`);
      return {
        content: [{ type: "text", text: lines.join("\n") }],
        details: { selections: result },
      };
    },
  });
}
