import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pageTranscript, readTranscript } from "../lib/domain/transcript.js";

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
        { type: "toolCall", name: "bash" },
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
    assert.deepEqual(messages[1].toolCalls, ["bash"]);
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
