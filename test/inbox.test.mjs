import test from "node:test";
import assert from "node:assert/strict";
import { lineCount, parseInbox } from "../lib/domain/inbox.js";

test("parseInbox reads typed messages and preserves line indices", () => {
  const text = [
    JSON.stringify({
      ts: "2026-01-01T00:00:00Z",
      type: "REVIEW_REQUEST",
      text: "look at src/a.ts",
    }),
    "",
    JSON.stringify({ type: "BLOCKED", text: "allow network?" }),
  ].join("\n");
  const { messages, malformed } = parseInbox(text);
  assert.equal(malformed, 0);
  assert.equal(messages.length, 2);
  assert.equal(messages[0].index, 0);
  assert.equal(messages[0].type, "REVIEW_REQUEST");
  assert.equal(messages[0].ts, "2026-01-01T00:00:00Z");
  assert.equal(messages[1].index, 2);
  assert.equal(messages[1].type, "BLOCKED");
});

test("parseInbox normalizes unknown types and skips malformed lines", () => {
  const text = [
    "{not json",
    JSON.stringify({ type: "WHATEVER", text: "still a note" }),
    JSON.stringify({ type: "NOTE" }),
    JSON.stringify({ type: "NOTE", text: "ok" }),
  ].join("\n");
  const { messages, malformed } = parseInbox(text);
  assert.equal(malformed, 2);
  assert.equal(messages.length, 2);
  assert.equal(messages[0].type, "NOTE");
  assert.equal(messages[1].text, "ok");
});

test("parseInbox tolerates a torn final line", () => {
  const { messages, malformed } = parseInbox('{"type":"NOTE","text":"ok"}\n{"type":"NO');
  assert.equal(messages.length, 1);
  assert.equal(malformed, 1);
});

test("lineCount matches the next offset", () => {
  assert.equal(lineCount(""), 0);
  assert.equal(lineCount("{}\n"), 1);
  assert.equal(lineCount("{}\n{}\n"), 2);
  assert.equal(lineCount("{}"), 1);
});
