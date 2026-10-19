import * as fs from "fs";
import * as os from "os";
import * as path from "path";

export interface BuildPiInvocationParams {
  agentPrompt: string;
  task: string;
  reads?: string[];
  model?: string;
  promptDir?: string;
}

export interface PiInvocation {
  args: string[];
  stdin: string;
  tempDir?: string;
}

/** Builds the pi child-process invocation while sending the task text through stdin. */
export function buildPiInvocation(params: BuildPiInvocationParams): PiInvocation {
  const args: string[] = [];

  let taskText = params.task;
  if (params.reads?.length) {
    taskText = `[Read from: ${params.reads.join(", ")}]\n\n${params.task}`;
  }

  args.push("--mode", "json");
  args.push("-p");
  args.push("--no-session");

  let tempDir: string | undefined;
  if (params.agentPrompt) {
    tempDir = params.promptDir ?? fs.mkdtempSync(path.join(os.tmpdir(), "kh-subagent-"));
    const promptPath = path.join(tempDir, "prompt.md");
    fs.mkdirSync(tempDir, { recursive: true });
    fs.writeFileSync(promptPath, params.agentPrompt, "utf-8");
    args.push("--system-prompt", promptPath);
  }

  if (params.model) {
    args.push("--model", params.model);
  }

  return {
    args,
    stdin: taskText,
    tempDir,
  };
}
