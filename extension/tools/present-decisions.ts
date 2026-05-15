import { Text, Container } from "@earendil-works/pi-tui";
import { Type } from "@sinclair/typebox";
import { DecisionForm } from "../ui/decision-form";
import type { Decision, DecisionOption } from "../ui/decision-form";
// @mariozechner/pi-coding-agent is deprecated upstream; will migrate when @samfp/pi-memory updates
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
      "Each decision automaticallyappends an 'other' option at the end for free-text input. " +
      "Default other label is 'Something else...'; otherLabel overrides it. " +
      "Do not add your own other option in decision options, and keep otherLabel short. " +
      "Use this when the user needs to make multiple related choices at once " +
      "(e.g. execution style + worktree strategy + autonomy level). " +
      "Do NOT ask the user to type their choices — call this tool instead.",
    parameters: PresentDecisionsParams,
    renderCall(args, theme) {
      const container = new Container();
      const decisionCount = args.decisions.length;
      const decisionLabel = decisionCount === 1 ? "decision" : "decisions";

      container.addChild(new Text(
        `${theme.fg("toolTitle", theme.bold("choices"))} ${theme.fg("dim", "· choose related options")}`,
        0, 0,
      ));
      container.addChild(new Text(
        `${theme.fg("accent", args.title)} ${theme.fg("dim", `· ${decisionCount} ${decisionLabel}`)}`,
        0, 0,
      ));
      return container;
    },

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
