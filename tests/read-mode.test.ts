import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { READ_ONLY_ROLES } from "../extension/write-mode/roles";

function readOnlyAgentNamesFromAgentsFile(): string[] {
  const agentsSource = readFileSync("AGENTS.md", "utf8");
  const readOnlyAgentMatches = agentsSource.matchAll(/- \*\*(.*?)\*\* .* Read-only\./g);

  return Array.from(readOnlyAgentMatches, (match) => match[1]);
}

describe("READ_ONLY_ROLES", () => {
  it("readOnlyRolesWithBundledReadOnlyAgentsMatchDocumentation", () => {
    assert.deepStrictEqual([...READ_ONLY_ROLES], readOnlyAgentNamesFromAgentsFile());
  });
});

describe("readModeSource", () => {
  it("readModeSourceWithReadModePromptUsesDescribeReadOnlyRoles", () => {
    const readModeSource = readFileSync("extension/write-mode/read-mode.ts", "utf8");
    assert.match(readModeSource, /\$\{describeReadOnlyRoles\(\)\} are fine\./);
  });
});
