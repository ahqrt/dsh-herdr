import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pageTranscript, readTranscript, toolCallPreview } from "../lib/domain/transcript.js";

const ENTRIES = [
  { type: "session", version: 3, id: "s1" },
  {
    type: "message",
    timestamp: "2026-01-01T00:00:00Z",
    message: { role: "user", content: "do it" },
  },
  {
    type: "message",
    message: {
      role: "assistant",
      content: [
        { type: "text", text: "working on it" },
        { type: "toolCall", name: "bash", arguments: { command: "npm test\n--watch" } },
      ],
    },
  },
  { type: "message", message: { role: "assistant", content: [{ type: "text", text: "done" }] } },
];

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "herdr-transcript-"));
  const path = join(dir, "session.jsonl");
  writeFileSync(path, `${ENTRIES.map((entry) => JSON.stringify(entry)).join("\n")}\n`, "utf8");
  return { dir, path };
}

test("readTranscript maps user/assistant turns and tool calls", () => {
  const { dir, path } = fixture();
  try {
    const messages = readTranscript(path);
    assert.equal(messages.length, 3);
    assert.equal(messages[0].role, "user");
    assert.equal(messages[0].text, "do it");
    assert.equal(messages[0].timestamp, "2026-01-01T00:00:00Z");
    assert.equal(messages[1].role, "assistant");
    assert.deepEqual(messages[1].toolCalls, [{ name: "bash", detail: "npm test --watch" }]);
    assert.equal(messages[2].text, "done");
    assert.deepEqual(
      messages.map((message) => message.index),
      [0, 1, 2],
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("pageTranscript clamps and reports the total", () => {
  const { dir, path } = fixture();
  try {
    const page = pageTranscript(path, { from: 1, limit: 1 });
    assert.equal(page.total, 3);
    assert.equal(page.messages.length, 1);
    assert.equal(page.messages[0].index, 1);

    const beyond = pageTranscript(path, { from: 99, limit: 10 });
    assert.equal(beyond.messages.length, 0);
    assert.equal(beyond.total, 3);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a missing or torn session degrades gracefully", () => {
  assert.deepEqual(readTranscript("/nonexistent/session.jsonl"), []);
  const dir = mkdtempSync(join(tmpdir(), "herdr-transcript-"));
  try {
    const path = join(dir, "s.jsonl");
    writeFileSync(
      path,
      '{"type":"message","message":{"role":"user","content":"hi"}}\n{"type":"mess',
      "utf8",
    );
    const messages = readTranscript(path);
    assert.equal(messages.length, 1);
    assert.equal(messages[0].text, "hi");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("tool results keep their tool name, error flag and duration", () => {
  const dir = mkdtempSync(join(tmpdir(), "herdr-transcript-"));
  try {
    const path = join(dir, "session.jsonl");
    const entries = [
      { type: "message", message: { role: "user", content: "look at it" } },
      {
        type: "message",
        message: {
          role: "assistant",
          content: [{ type: "toolCall", name: "read", arguments: { path: "/repo/a.ts" } }],
        },
      },
      {
        type: "message",
        timestamp: "2026-01-01T00:00:03Z",
        message: {
          role: "toolResult",
          toolName: "read",
          isError: true,
          durationMs: 1500,
          content: [{ type: "text", text: "boom" }],
        },
      },
    ];
    writeFileSync(path, `${entries.map((entry) => JSON.stringify(entry)).join("\n")}\n`, "utf8");
    const messages = readTranscript(path);
    assert.equal(messages.length, 3);
    assert.deepEqual(messages[1].toolCalls, [{ name: "read", detail: "/repo/a.ts" }]);
    assert.equal(messages[2].role, "tool");
    assert.equal(messages[2].toolName, "read");
    assert.equal(messages[2].isError, true);
    assert.equal(messages[2].durationMs, 1500);
    assert.equal(messages[2].text, "boom");
    assert.equal(messages[2].timestamp, "2026-01-01T00:00:03Z");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("toolCallPreview prefers a readable argument and collapses newlines", () => {
  assert.equal(toolCallPreview({ command: "a\n  b" }), "a b");
  assert.equal(toolCallPreview({ path: "/tmp/x" }), "/tmp/x");
  assert.equal(toolCallPreview({ pattern: "TODO" }), "TODO");
  assert.equal(toolCallPreview({ weird: "value" }), "value");
  assert.equal(toolCallPreview({ nested: { a: 1 } }), '{"nested":{"a":1}}');
  assert.equal(toolCallPreview(undefined), "");
  assert.equal(toolCallPreview({}), "");
  assert.ok(toolCallPreview({ command: "x".repeat(400) }).length <= 220);
});
