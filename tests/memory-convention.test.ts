import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  MEMORY_NAMESPACES,
  validateMemoryKey,
} from "../extension/memory-convention";

describe("validateMemoryKey", () => {
  it("accepts valid namespace-first project keys", () => {
    assert.strictEqual(
      validateMemoryKey("project.know-how.memory-key-format", "know-how"),
      null,
    );
    assert.strictEqual(
      validateMemoryKey("project.bishop.room-grid-api", "bishop"),
      null,
    );
  });

  it("rejects keys with wrong segment count", () => {
    assert.ok(
      validateMemoryKey("project.know-how", "know-how") !== null,
      "2 segments should fail",
    );
    assert.ok(
      validateMemoryKey("project", "know-how") !== null,
      "1 segment should fail",
    );
    assert.ok(
      validateMemoryKey("project.know-how.foo.bar", "know-how") !== null,
      "4 segments should fail",
    );
  });

  it("rejects unknown namespace", () => {
    assert.ok(
      validateMemoryKey("pref.know-how.editor", "know-how") !== null,
      "unknown namespace should fail",
    );
  });

  it("rejects project name mismatch", () => {
    assert.ok(
      validateMemoryKey("project.bishop.memory-key-format", "know-how") !== null,
      "project segment 'bishop' != expected 'know-how'",
    );
  });

  it("rejects empty fact segment", () => {
    assert.ok(
      validateMemoryKey("project.know-how.", "know-how") !== null,
      "empty fact should fail",
    );
    assert.ok(
      validateMemoryKey("project.know-how", "know-how") !== null,
      "missing fact segment should fail",
    );
  });

  it("accepts project names containing hyphens", () => {
    assert.strictEqual(
      validateMemoryKey("project.some-project.some-fact", "some-project"),
      null,
    );
  });

  it("accepts fact names containing hyphens", () => {
    assert.strictEqual(
      validateMemoryKey("project.know-how.my-long-fact-name", "know-how"),
      null,
    );
  });
});

describe("MEMORY_NAMESPACES", () => {
  it("contains exactly project", () => {
    assert.deepStrictEqual([...MEMORY_NAMESPACES], ["project"]);
  });
});
