/** Parsed assistant text and surfaced error extracted from subagent JSONL output. */
export interface ExtractedResponse {
  text: string;
  error?: string;
}

/** Final parsed response plus bounded raw tails kept for fallback diagnostics. */
export interface CollectedResponse extends ExtractedResponse {
  stdoutTail: string;
  stderrTail: string;
}

interface ResponseEvent {
  type?: string;
  error?: unknown;
  message?: {
    role?: string;
    content?: Array<{ type?: string; text?: string }>;
    stopReason?: string;
    errorMessage?: string;
  };
}

const DEFAULT_TAIL_LIMIT = 16_000;

function extractErrorText(error: unknown): string | undefined {
  if (typeof error === "string") {
    return error;
  }
  if (!error || typeof error !== "object") {
    return undefined;
  }

  const candidate = error as { errorMessage?: unknown; message?: unknown; error?: unknown };
  if (typeof candidate.errorMessage === "string") {
    return candidate.errorMessage;
  }
  if (typeof candidate.message === "string") {
    return candidate.message;
  }
  return extractErrorText(candidate.error);
}

function applyEventLine(
  rawLine: string,
  parts: string[],
  surfacedError: string | undefined,
): string | undefined {
  const trimmed = rawLine.trim();
  if (!trimmed) {
    return surfacedError;
  }

  let evt: ResponseEvent;
  try {
    evt = JSON.parse(trimmed) as ResponseEvent;
  } catch {
    return !surfacedError && trimmed.startsWith("Error:") ? trimmed : surfacedError;
  }

  if (evt.type === "error") {
    return extractErrorText(evt.error) ?? surfacedError;
  }

  if (evt.type === "message_end" && evt.message?.role === "assistant") {
    if (evt.message.stopReason === "error" || evt.message.stopReason === "aborted") {
      surfacedError = evt.message.errorMessage
        ?? surfacedError
        ?? `Assistant stopped with reason: ${evt.message.stopReason}`;
    }
    if (evt.message.content) {
      for (const part of evt.message.content) {
        if (part.type === "text" && part.text) {
          parts.push(part.text);
        }
      }
    }
  }

  return surfacedError;
}

/** Keeps only the trailing portion of a growing stream buffer within a fixed limit. */
export function appendBoundedTail(existing: string, chunk: string, limit: number): string {
  if (limit <= 0) {
    return "";
  }
  if (chunk.length >= limit) {
    return chunk.slice(-limit);
  }

  const keepExisting = Math.max(0, limit - chunk.length);
  const existingTail = existing.length > keepExisting ? existing.slice(-keepExisting) : existing;
  return existingTail + chunk;
}

/** Incrementally parses subagent JSONL stdout while retaining only bounded raw tails. */
export function createResponseCollector(tailLimit: number = DEFAULT_TAIL_LIMIT) {
  const parts: string[] = [];
  let surfacedError: string | undefined;
  let stdoutTail = "";
  let stderrTail = "";
  let stdoutLineBuffer = "";

  return {
    appendStdout(chunk: string): void {
      stdoutTail = appendBoundedTail(stdoutTail, chunk, tailLimit);
      stdoutLineBuffer += chunk;
      const rawLines = stdoutLineBuffer.split("\n");
      stdoutLineBuffer = rawLines.pop() ?? "";
      for (const rawLine of rawLines) {
        surfacedError = applyEventLine(rawLine, parts, surfacedError);
      }
    },

    appendStderr(chunk: string): void {
      stderrTail = appendBoundedTail(stderrTail, chunk, tailLimit);
    },

    finalize(): CollectedResponse {
      if (stdoutLineBuffer.length > 0) {
        surfacedError = applyEventLine(stdoutLineBuffer, parts, surfacedError);
        stdoutLineBuffer = "";
      }

      return {
        text: parts.join("\n").trim(),
        error: surfacedError,
        stdoutTail,
        stderrTail,
      };
    },
  };
}

/** Extracts assistant text and surfaced errors from a complete stdout snapshot. */
export function extractResponse(stdout: string): ExtractedResponse {
  const collector = createResponseCollector();
  collector.appendStdout(stdout);
  const { text, error } = collector.finalize();
  return { text, error };
}
