import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  parseSessionEntries,
  assistantText,
  extractLastAssistant,
  extractSessionResult,
  minedAssistantError,
  sessionStats,
} from "../lib/domain/session.js";

const LINES = [
  { type: "session", version: 3, id: "s1", cwd: "/tmp/x" },
  { type: "message", message: { role: "user", content: "do it" } },
  {
    type: "message",
    message: {
      role: "assistant",
      content: [
        { type: "text", text: "working on it" },
        { type: "toolCall", name: "bash", arguments: { command: "ls" } },
      ],
      usage: { output: 12 },
    },
  },
  {
    type: "message",
    message: {
      role: "assistant",
      content: [{ type: "text", text: "done: 3 files changed" }],
      usage: { output: 7 },
    },
  },
];

function fixture(extraLines = []) {
  const dir = mkdtempSync(join(tmpdir(), "herdr-session-"));
  const path = join(dir, "session.jsonl");
  const text = [...LINES, ...extraLines].map((l) => JSON.stringify(l)).join("\n") + "\n";
  writeFileSync(path, text, "utf8");
  return { dir, path, text };
}

test("parseSessionEntries tolerates a torn final line", () => {
  const { entries, malformed } = parseSessionEntries('{"type":"a"}\n{"type":"b"');
  assert.equal(entries.length, 1);
  assert.equal(malformed, 1);
});

test("assistantText joins only text blocks", () => {
  const msg = LINES[3].message;
  assert.equal(assistantText(msg), "done: 3 files changed");
  const mixed = LINES[2].message;
  assert.equal(assistantText(mixed), "working on it");
});

test("extractLastAssistant returns the exact last assistant message", () => {
  const { entries } = parseSessionEntries(LINES.map((l) => JSON.stringify(l)).join("\n"));
  const hit = extractLastAssistant(entries);
  assert.equal(hit.text, "done: 3 files changed");
  assert.equal(hit.message.role, "assistant");
});

test("extractSessionResult reads from disk and returns null when missing", () => {
  const { dir, path } = fixture();
  try {
    assert.equal(extractSessionResult(path).text, "done: 3 files changed");
    assert.equal(extractSessionResult(join(dir, "nope.jsonl")), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("minedAssistantError only fires for stopReason=error", () => {
  assert.equal(minedAssistantError({ role: "assistant", content: [] }), null);
  const mined = minedAssistantError({ stopReason: "error", errorMessage: "rate limited" });
  assert.deepEqual(mined, { stopReason: "error", errorMessage: "rate limited" });
});

test("sessionStats counts assistant messages, tool calls, output tokens", () => {
  const { dir, path } = fixture();
  try {
    const stats = sessionStats(path);
    assert.equal(stats.assistant, 2);
    assert.equal(stats.toolCalls, 1);
    assert.equal(stats.outputTokens, 19);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
