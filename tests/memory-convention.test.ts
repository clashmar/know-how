import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateMemoryKey, MEMORY_DOMAINS } from "../extension/memory-convention";

describe("validateMemoryKey", () => {
  it("accepts valid keys for all three domains", () => {
    assert.strictEqual(
      validateMemoryKey("know-how.project.module-structure", "know-how"),
      null,
    );
    assert.strictEqual(
      validateMemoryKey("bishop.decision.room-grid-api", "bishop"),
      null,
    );
    assert.strictEqual(
      validateMemoryKey("know-how.lesson.ad-hoc-memory-keys", "know-how"),
      null,
    );
  });

  it("rejects keys with wrong segment count", () => {
    assert.ok(
      validateMemoryKey("know-how.project", "know-how") !== null,
      "2 segments should fail",
    );
    assert.ok(
      validateMemoryKey("know-how", "know-how") !== null,
      "1 segment should fail",
    );
    assert.ok(
      validateMemoryKey("know-how.project.foo.bar", "know-how") !== null,
      "4 segments should fail",
    );
  });

  it("rejects unknown domain", () => {
    assert.ok(
      validateMemoryKey("bishop.foo.something", "bishop") !== null,
      "unknown domain 'foo' should fail",
    );
  });

  it("rejects project name mismatch", () => {
    assert.ok(
      validateMemoryKey("bishop.decision.know-how-fact", "know-how") !== null,
      "project segment 'bishop' != expected 'know-how'",
    );
  });

  it("rejects empty fact segment", () => {
    assert.ok(
      validateMemoryKey("know-how.project.", "know-how") !== null,
      "empty fact should fail",
    );
    assert.ok(
      validateMemoryKey("know-how.project", "know-how") !== null,
      "missing fact segment should fail",
    );
  });

  it("accepts project names containing hyphens", () => {
    assert.strictEqual(
      validateMemoryKey("some-project.decision.some-fact", "some-project"),
      null,
    );
  });

  it("accepts fact names containing hyphens", () => {
    assert.strictEqual(
      validateMemoryKey("know-how.decision.my-long-fact-name", "know-how"),
      null,
    );
  });
});

describe("MEMORY_DOMAINS", () => {
  it("contains exactly project, decision, lesson", () => {
    assert.deepStrictEqual([...MEMORY_DOMAINS].sort(), ["decision", "lesson", "project"]);
  });
});
